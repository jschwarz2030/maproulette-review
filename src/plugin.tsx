import { type ComponentType, useEffect, useId, useState } from 'react'
import {
  cancelTaskReview,
  fetchReviewQueue,
  fetchTestQuery,
  startTaskReview,
  updateTaskReviewStatus,
} from './reviewApi'

type RouteParams = Record<string, string>

type HostUiComponents = {
  Button: ComponentType<Record<string, unknown>>
  Label: ComponentType<Record<string, unknown>>
  Textarea: ComponentType<Record<string, unknown>>
}

type PluginPage = {
  id: string
  title: string
  path: string
  description?: string
  component: ComponentType<{ params?: RouteParams }>
}

type PluginNavigationItem = {
  id: string
  label: string
  to: string
  order?: number
}

type PluginApiContext = {
  theme?: {
    isDarkMode: () => boolean
    getThemeTokens: () => Record<string, string>
  }
  apiRequest?: {
    put: (
      url: string,
      options?: {
        json?: unknown
      }
    ) => {
      json: <T = unknown>() => Promise<T>
      text: () => Promise<string>
    }
    get: (url: string) => {
      json: <T = unknown>() => Promise<T>
      text: () => Promise<string>
    }
  }
  navigate?: (path: string) => void
  user?: { id: number } | null
  ui?: HostUiComponents
}

type Plugin = {
  metadata: {
    id: string
    name: string
    description: string
    version: string
    author?: string
  }
  initialize?: (context?: PluginApiContext) => void
  getNavigationItems?: () => PluginNavigationItem[]
  getPages?: () => PluginPage[]
  getTaskActionExtensions?: () => Array<{
    id: string
    label?: string
    order?: number
    component: ComponentType<{
      task: unknown
      newStatus: number
      setNewStatus: (status: number) => void
      formState: Record<string, unknown>
      setFormState: (patch: Record<string, unknown>) => void
    }>
    getStatusQueryParams?: (
      formState: Record<string, unknown>,
      context: { newStatus: number; task: unknown }
    ) => Record<string, string | boolean | number | undefined | null>
  }>
  getTaskActionPanels?: () => Array<{
    id: string
    label?: string
    slot?: 'replace' | 'append'
    order?: number
    isActive?: (context: {
      pathname: string
      search: Record<string, unknown>
      task: unknown
    }) => boolean
    component: ComponentType<{
      task: unknown
      search: Record<string, unknown>
      pathname: string
    }>
  }>
  getUserSettingsFields?: () => Array<{
    id: string
    name: string
    order?: number
    component: ComponentType<{
      value: unknown
      onChange: (value: unknown) => void
      disabled?: boolean
    }>
  }>
}

let hostUiFromInit: HostUiComponents | undefined
let hostApiRequest: PluginApiContext['apiRequest']
let hostNavigate: ((path: string) => void) | undefined
let hostUser: { id: number } | null | undefined

type TaskReviewFields = {
  reviewStatus?: number | null
  reviewClaimedBy?: number | null
  reviewRequestedBy?: number | null
}

type ReviewTask = {
  id: number
  name?: string
  instruction?: string
  status?: number
  priority?: number
  review?: TaskReviewFields
  completedBy?: number | null
  mappedOn?: string
  location?: unknown
  geometries?: unknown
  parent?: number | {
    id?: number
    name?: string
  }
}

const getReviewFields = (task: ReviewTask): TaskReviewFields =>
  task.review ?? {
    reviewStatus: (task as { reviewStatus?: number | null }).reviewStatus,
    reviewClaimedBy: (task as { reviewClaimedBy?: number | null }).reviewClaimedBy,
  }

const REVIEW_STATUS_LABELS: Record<number, string> = {
  [-1]: 'Not requested',
  0: 'Requested',
  1: 'Approved',
  2: 'Rejected',
  3: 'Approved with fixes',
  4: 'Disputed',
  5: 'Unnecessary',
  6: 'Approved with revisions',
  7: 'Approved with fixes after revisions',
}

const formatReviewStatus = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'Not set'
  return REVIEW_STATUS_LABELS[value] ?? `Status ${value}`
}

const reviewStatusLabel = (value: number | undefined): string => {
  if (value === 0) return 'needed'
  if (value === 1) return 'approved'
  if (value === 2) return 'rejected'
  if (value === 3) return 'approved_with_fixes'
  if (value === 4) return 'disputed'
  return 'unset'
}

const getHostUi = (): HostUiComponents => {
  const liveContext = (
    window as unknown as {
      __maproulettePluginApi?: {
        ui?: HostUiComponents
      }
    }
  ).__maproulettePluginApi

  if (liveContext?.ui?.Button) {
    return liveContext.ui
  }
  if (hostUiFromInit?.Button) {
    return hostUiFromInit
  }

  throw new Error('Host UI kit is unavailable')
}

const getHostPluginApi = (): {
  user?: { id: number } | null
} | undefined => {
  const liveContext = (
    window as unknown as {
      __maproulettePluginApi?: {
        user?: { id: number } | null
      }
    }
  ).__maproulettePluginApi

  return {
    user: liveContext?.user ?? hostUser ?? null,
  }
}

const navigateInHostApp = (path: string): void => {
  if (typeof window === 'undefined') return
  if (hostNavigate) {
    hostNavigate(path)
    return
  }
  window.location.assign(path)
}

const handleHostNavigationClick = (
  event: {
    preventDefault: () => void
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    button?: number
  },
  path: string
): void => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return
  }

  event.preventDefault()
  navigateInHostApp(path)
}

type ReviewQueueTab = 'toReview' | 'reviewed'

const parseReviewTasks = (response: unknown): ReviewTask[] => {
  if (Array.isArray(response)) {
    return response.filter((item): item is ReviewTask => {
      return typeof item === 'object' && item !== null && Number.isFinite((item as { id?: number }).id)
    })
  }

  if (typeof response === 'object' && response !== null) {
    const asRecord = response as { tasks?: unknown }
    if (Array.isArray(asRecord.tasks)) {
      return asRecord.tasks.filter((item): item is ReviewTask => {
        return (
          typeof item === 'object' &&
          item !== null &&
          Number.isFinite((item as { id?: number }).id)
        )
      })
    }
  }

  return []
}

const ReviewTasksPage = ({ kind }: { kind: ReviewQueueTab }) => {
  const { Button } = getHostUi()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<ReviewTask[]>([])
  const [testQueryResult, setTestQueryResult] = useState<string | null>(null)
  const [testQueryError, setTestQueryError] = useState<string | null>(null)

  const loadTasks = async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetchReviewQueue(kind)
      setTasks(parseReviewTasks(response))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading review tasks'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [kind])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await fetchTestQuery()
        if (!cancelled) {
          setTestQueryResult(result)
          setTestQueryError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setTestQueryResult(null)
          setTestQueryError(err instanceof Error ? err.message : 'TEST_QUERY request failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const title = kind === 'toReview' ? 'To Review' : 'Reviewed'
  const description =
    kind === 'toReview'
      ? 'Fixed tasks that still need review.'
      : 'Tasks you have reviewed or requested review for.'
  const emptyMessage =
    kind === 'toReview' ? 'No tasks waiting for review.' : 'No reviewed tasks found.'

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="mt-0 text-lg font-semibold">{title}</h2>
          <p className="mb-0 text-sm text-zinc-600 dark:text-slate-400">{description}</p>
          {testQueryResult && (
            <p className="mb-0 mt-1 text-xs text-zinc-500 dark:text-slate-400">{testQueryResult}</p>
          )}
          {testQueryError && (
            <p className="mb-0 mt-1 text-xs text-red-600 dark:text-red-400">{testQueryError}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadTasks()}>
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex gap-2 border-b border-zinc-200 dark:border-slate-700">
        <a
          href="/review"
          className={`border-b-2 px-3 py-2 text-sm font-medium no-underline ${
            kind === 'toReview'
              ? 'border-zinc-900 text-zinc-900 dark:border-slate-100 dark:text-slate-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          onClick={(event) => handleHostNavigationClick(event, '/review')}
        >
          To Review
        </a>
        <a
          href="/reviewed"
          className={`border-b-2 px-3 py-2 text-sm font-medium no-underline ${
            kind === 'reviewed'
              ? 'border-zinc-900 text-zinc-900 dark:border-slate-100 dark:text-slate-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          onClick={(event) => handleHostNavigationClick(event, '/reviewed')}
        >
          Reviewed
        </a>
      </div>

      {loading && <p className="text-sm">Loading tasks…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-slate-700">
                <th className="py-2 pr-4 font-medium">Task</th>
                <th className="py-2 pr-4 font-medium">Challenge</th>
                <th className="py-2 pr-4 font-medium">Review Status</th>
                <th className="py-2 pr-4 font-medium">Mapped On</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-zinc-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4">#{task.id}</td>
                  <td className="py-2 pr-4">
                    {typeof task.parent === 'object' && task.parent?.name
                      ? `${task.parent.name} (#${task.parent.id || 'n/a'})`
                      : 'n/a'}
                  </td>
                  <td className="py-2 pr-4">
                    {reviewStatusLabel(getReviewFields(task).reviewStatus ?? undefined)}
                  </td>
                  <td className="py-2 pr-4">{task.mappedOn || 'n/a'}</td>
                  <td className="py-2">
                    <a
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      href={`/tasks/${task.id}?review=true`}
                      onClick={(event) =>
                        handleHostNavigationClick(event, `/tasks/${task.id}?review=true`)
                      }
                    >
                      {kind === 'toReview' ? 'Open Review' : 'Open Task'}
                    </a>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-zinc-500 dark:text-slate-400">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const ToReviewPage = (_props: { params?: RouteParams }) => <ReviewTasksPage kind="toReview" />
const ReviewedPage = (_props: { params?: RouteParams }) => <ReviewTasksPage kind="reviewed" />

const RequestReviewExtension = ({
  newStatus,
  formState,
  setFormState,
}: {
  task: unknown
  newStatus: number
  setNewStatus: (status: number) => void
  formState: Record<string, unknown>
  setFormState: (patch: Record<string, unknown>) => void
}) => {
  const isCompletionStatus = [1, 2, 5, 6].includes(newStatus)
  const checked = Boolean(formState.requestReview)

  useEffect(() => {
    if (isCompletionStatus && !('requestReview' in formState)) {
      setFormState({ requestReview: newStatus === 1 })
    }
  }, [newStatus, isCompletionStatus, formState, setFormState])

  if (!isCompletionStatus) {
    return null
  }

  const { Label } = getHostUi()

  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(event) => setFormState({ requestReview: event.target.checked })}
      />
      <span className="flex flex-col gap-0.5">
        <Label className="cursor-pointer">Request review for this task</Label>
        <span className="text-xs text-zinc-500 dark:text-slate-400">
          Sends completed tasks to the review queue.
        </span>
      </span>
    </label>
  )
}

const isReviewModeActive = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  const review = new URLSearchParams(window.location.search).get('review')
  return review === 'true' || review === '1'
}

const ReviewTaskActionsPanel = ({
  task: taskProp,
}: {
  task: unknown
  search: Record<string, unknown>
  pathname: string
}) => {
  const { Button, Label, Textarea } = getHostUi()
  const commentFieldId = useId()
  const [task, setTask] = useState(taskProp as ReviewTask)
  const [comment, setComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    setTask(taskProp as ReviewTask)
  }, [taskProp])

  const reviewFields = getReviewFields(task)
  const hostApi = getHostPluginApi()
  const myId = hostApi?.user?.id ?? null
  const claimedBy = reviewFields.reviewClaimedBy ?? null
  const isClaimedByMe = myId != null && claimedBy === myId

  const runAction = async (action: () => Promise<ReviewTask>, successMessage: string) => {
    try {
      setError(null)
      setStatusMessage(null)
      setIsLoading(true)
      const updatedTask = await action()
      setTask(updatedTask)
      setStatusMessage(successMessage)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown review error'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClaim = () => {
    void runAction(() => startTaskReview<ReviewTask>(task.id), 'Task claimed for review')
  }

  const handleCancelClaim = () => {
    void runAction(() => cancelTaskReview<ReviewTask>(task.id), 'Review claim released')
  }

  const submitReview = (reviewStatus: number, label: string) => {
    void runAction(async () => {
      const updatedTask = await updateTaskReviewStatus<ReviewTask>({
        taskId: task.id,
        reviewStatus,
        comment,
      })
      setComment('')
      navigateInHostApp('/review')
      return updatedTask
    }, `Review: ${label}`)
  }

  return (
    <div className="rounded-lg bg-zinc-100 p-1.5 dark:bg-slate-800/60">
      <div className="mb-1.5 px-1 font-medium text-xs text-zinc-500 uppercase tracking-wider dark:text-slate-400">
        Review
      </div>
      <p className="mb-2 px-1 text-center text-xs text-zinc-600 dark:text-slate-400">
        Current: {formatReviewStatus(reviewFields.reviewStatus)}
        {claimedBy != null && (
          <span className="block">
            {isClaimedByMe ? 'Claimed by you' : `Claimed by user #${claimedBy}`}
          </span>
        )}
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isLoading || isClaimedByMe}
          onClick={handleClaim}
          title="Claim this task for review"
        >
          {isLoading ? 'Claiming…' : 'Claim for review'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isLoading || !isClaimedByMe}
          onClick={handleCancelClaim}
          title="Release your review claim"
        >
          {isLoading ? 'Releasing…' : 'Release claim'}
        </Button>
      </div>

      <div className="mb-2 px-1">
        <Label htmlFor={commentFieldId} className="text-xs">
          Review comment (optional)
        </Label>
        <Textarea
          id={commentFieldId}
          rows={3}
          className="mt-1 text-sm"
          placeholder="Notes for the mapper or other reviewers…"
          value={comment}
          onChange={(event: { target: { value: string } }) => setComment(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="success"
          size="sm"
          disabled={isLoading}
          onClick={() => submitReview(1, 'Approved')}
          title="Approve review"
        >
          Approve
        </Button>
        <Button
          variant="warning"
          size="sm"
          disabled={isLoading}
          onClick={() => submitReview(3, 'Approved with fixes')}
          title="Approve with fixes"
        >
          With fixes
        </Button>
        <Button
          variant="caution"
          size="sm"
          className="col-span-2"
          disabled={isLoading}
          onClick={() => submitReview(2, 'Rejected')}
          title="Reject review"
        >
          Reject
        </Button>
      </div>

      {statusMessage && (
        <p className="mt-2 px-1 text-center text-xs text-zinc-600 dark:text-slate-400">
          {statusMessage}
        </p>
      )}
      {error && (
        <p className="mt-2 px-1 text-center text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

const ReviewerSettingsField = ({
  value,
  onChange,
  disabled,
}: {
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) => {
  const { Label } = getHostUi()
  const yesId = useId()
  const noId = useId()
  const isReviewer = Boolean(value)

  return (
    <div className="space-y-2">
      <Label className="font-medium text-sm">Volunteer as a Reviewer</Label>
      <div className="flex gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="isReviewer"
            id={yesId}
            checked={isReviewer}
            disabled={disabled}
            onChange={() => onChange(true)}
          />
          <span className="text-sm">Yes</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="isReviewer"
            id={noId}
            checked={!isReviewer}
            disabled={disabled}
            onChange={() => onChange(false)}
          />
          <span className="text-sm">No</span>
        </label>
      </div>
      <p className="text-xs text-zinc-500 dark:text-slate-400">
        Volunteer to review tasks for which a review has been requested
      </p>
    </div>
  )
}

const plugin: Plugin = {
  metadata: {
    id: 'maproulette-review-plugin',
    name: 'MapRoulette Review',
    description: 'Demo remote plugin served from a separate application',
    version: '0.1.0',
    author: 'MapRoulette Team',
  },
  initialize: (context) => {
    hostUiFromInit = context?.ui
    hostApiRequest = context?.apiRequest
    hostNavigate = context?.navigate
    hostUser = context?.user ?? null
  },
  getNavigationItems: () => [
    {
      id: 'maproulette-review-nav-to-review',
      label: 'To Review',
      to: '/review',
      order: 90,
    },
    {
      id: 'maproulette-review-nav-reviewed',
      label: 'Reviewed',
      to: '/reviewed',
      order: 91,
    },
  ],
  getPages: () => [
    {
      id: 'maproulette-review-to-review-page',
      title: 'To Review',
      path: '/review',
      component: ToReviewPage,
      description: 'Tasks waiting for review',
    },
    {
      id: 'maproulette-review-reviewed-page',
      title: 'Reviewed',
      path: '/reviewed',
      component: ReviewedPage,
      description: 'Tasks already reviewed',
    },
  ],
  getTaskActionExtensions: () => [
    {
      id: 'maproulette-review-request-review',
      label: 'Request Review',
      order: 10,
      component: RequestReviewExtension,
      getStatusQueryParams: (formState) => ({
        requestReview:
          typeof formState.requestReview === 'boolean' ? formState.requestReview : undefined,
      }),
    },
  ],
  getTaskActionPanels: () => [
    {
      id: 'maproulette-review-task-panel',
      label: 'Review Task Actions',
      slot: 'replace',
      order: 10,
      isActive: () => isReviewModeActive(),
      component: ReviewTaskActionsPanel,
    },
  ],
  getUserSettingsFields: () => [
    {
      id: 'maproulette-review-volunteer-reviewer',
      name: 'isReviewer',
      order: 20,
      component: ReviewerSettingsField,
    },
  ],
}

;(window as unknown as Record<string, unknown>).maprouletteReviewPlugin = plugin

export default plugin
