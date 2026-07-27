import { type ComponentType, type ReactNode, useEffect, useId, useState } from 'react'
import {
  cancelTaskReview,
  type ChallengeReviewMetrics,
  fetchChallengeReviewProgress,
  fetchNearbyChallengeReviews,
  fetchNextChallengeReview,
  fetchReviewQueue,
  fetchTestQuery,
  startTaskReview,
  updateTaskReviewStatus,
} from './reviewApi'

type RouteParams = Record<string, string>

type PluginTaskMapItem = {
  id: number
  parent: number
  bundleId?: number | null
  location: {
    coordinates: [number, number]
  }
}

type HostUiComponents = {
  Button: ComponentType<Record<string, unknown>>
  Badge: ComponentType<Record<string, unknown>>
  Alert: ComponentType<Record<string, unknown>>
  AlertTitle: ComponentType<Record<string, unknown>>
  AlertDescription: ComponentType<Record<string, unknown>>
  Separator: ComponentType<Record<string, unknown>>
  StatCard: ComponentType<Record<string, unknown>>
  StatCardGrid: ComponentType<Record<string, unknown>>
  ProgressBar: ComponentType<Record<string, unknown>>
  Label: ComponentType<Record<string, unknown>>
  Textarea: ComponentType<Record<string, unknown>>
  Tabs: ComponentType<Record<string, unknown>>
  TabsList: ComponentType<Record<string, unknown>>
  TabsTrigger: ComponentType<Record<string, unknown>>
  TabsContent: ComponentType<Record<string, unknown>>
  Dialog: ComponentType<Record<string, unknown>>
  DialogContent: ComponentType<Record<string, unknown>>
  DialogHeader: ComponentType<Record<string, unknown>>
  DialogFooter: ComponentType<Record<string, unknown>>
  DialogTitle: ComponentType<Record<string, unknown>>
  DialogDescription: ComponentType<Record<string, unknown>>
  RadioGroup: ComponentType<Record<string, unknown>>
  RadioGroupItem: ComponentType<Record<string, unknown>>
  TaskSelectionMap: ComponentType<{
    currentTask: PluginTaskMapItem
    tasks: PluginTaskMapItem[]
    selectedTaskId: number | null
    onTaskSelect: (taskId: number | null) => void
  }>
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

type PluginUser = {
  id: number
  settings?: {
    isReviewer?: boolean | null
  }
}

type ChallengeActionContext = {
  challenge: unknown
  user?: PluginUser | null
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
  user?: PluginUser | null
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
  getChallengeFooterExtensions?: () => Array<{
    id: string
    order?: number
    component: ComponentType<ChallengeActionContext & { mapContent: ReactNode }>
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
let hostUser: PluginUser | null | undefined
/** Plugin-owned cache of volunteer-as-reviewer status (not read from core). */
let cachedIsReviewer = false

const rememberReviewerStatus = (user?: PluginUser | null): void => {
  if (!user) return
  cachedIsReviewer = Boolean(user.settings?.isReviewer)
  hostUser = {
    id: user.id,
    settings: {
      isReviewer: user.settings?.isReviewer ?? null,
    },
  }
}

const loadReviewerStatus = async (): Promise<boolean> => {
  if (!hostApiRequest) {
    return cachedIsReviewer
  }
  try {
    const whoAmI = await hostApiRequest.get('api/v2/user/whoami').json<{
      id?: number
      settings?: { isReviewer?: boolean | null }
    }>()
    if (typeof whoAmI?.id === 'number') {
      rememberReviewerStatus({
        id: whoAmI.id,
        settings: { isReviewer: whoAmI.settings?.isReviewer ?? null },
      })
    }
  } catch {
    // Keep the last known value if whoami fails.
  }
  return cachedIsReviewer
}

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
  location?: {
    coordinates: [number, number]
  }
  geometries?: unknown
  bundleId?: number | null
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

const getReviewStatusVariant = (
  status?: number | null
): 'secondary' | 'success' | 'destructive' | 'warning' | 'caution' | 'outline' => {
  switch (status) {
    case 0:
      return 'secondary'
    case 1:
    case 6:
      return 'success'
    case 2:
      return 'destructive'
    case 3:
    case 7:
      return 'warning'
    case 4:
      return 'caution'
    default:
      return 'outline'
  }
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
  user?: PluginUser | null
} | undefined => {
  return {
    user: hostUser ?? null,
  }
}

/** True when the signed-in user has volunteered as a reviewer (plugin-owned check). */
const isCurrentUserReviewer = (user?: PluginUser | null): boolean => {
  if (user) {
    rememberReviewerStatus(user)
  }
  return cachedIsReviewer
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
  const [canReview, setCanReview] = useState(() => isCurrentUserReviewer())

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
    void loadReviewerStatus().then((isReviewer) => {
      if (!cancelled) setCanReview(isReviewer)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

      {!canReview && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Volunteer as a reviewer in{' '}
          <a
            href="/settings"
            className="font-medium underline"
            onClick={(event) => handleHostNavigationClick(event, '/settings')}
          >
            Settings
          </a>{' '}
          to open tasks in review mode.
        </p>
      )}

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
                    {canReview ? (
                      <a
                        className="text-blue-600 hover:underline dark:text-blue-400"
                        href={`/tasks/${task.id}?review=true`}
                        onClick={(event) =>
                          handleHostNavigationClick(event, `/tasks/${task.id}?review=true`)
                        }
                      >
                        {kind === 'toReview' ? 'Open Review' : 'Open Task'}
                      </a>
                    ) : (
                      <span className="text-zinc-400 dark:text-slate-500">Review locked</span>
                    )}
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
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Label,
    RadioGroup,
    RadioGroupItem,
    TaskSelectionMap,
    Textarea,
  } = getHostUi()
  const commentFieldId = useId()
  const randomReviewId = useId()
  const nearbyReviewId = useId()
  const [task, setTask] = useState(taskProp as ReviewTask)
  const [comment, setComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [pendingReview, setPendingReview] = useState<{ status: number; label: string } | null>(null)
  const [nextTaskType, setNextTaskType] = useState<'random' | 'nearby'>('random')
  const [nearbyTasks, setNearbyTasks] = useState<ReviewTask[]>([])
  const [selectedNearbyTaskId, setSelectedNearbyTaskId] = useState<number | null>(null)
  const [isLoadingContinuation, setIsLoadingContinuation] = useState(false)
  const [continuationError, setContinuationError] = useState<string | null>(null)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [isLastReviewTask, setIsLastReviewTask] = useState(false)
  const [canReview, setCanReview] = useState<boolean | null>(() =>
    cachedIsReviewer ? true : null
  )

  useEffect(() => {
    setTask(taskProp as ReviewTask)
  }, [taskProp])

  useEffect(() => {
    let cancelled = false
    void loadReviewerStatus().then((isReviewer) => {
      if (!cancelled) setCanReview(isReviewer)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reviewFields = getReviewFields(task)
  const hostApi = getHostPluginApi()
  const myId = hostApi?.user?.id ?? null
  const claimedBy = reviewFields.reviewClaimedBy ?? null
  const isClaimedByMe = myId != null && claimedBy === myId
  const challengeIdFromSearch =
    typeof window === 'undefined'
      ? null
      : Number(new URLSearchParams(window.location.search).get('reviewChallengeId')) || null
  const reviewChallengeId =
    challengeIdFromSearch ??
    (typeof task.parent === 'number' ? task.parent : (task.parent?.id ?? null))

  if (canReview === null) {
    return (
      <p className="px-1 py-2 text-center text-xs text-zinc-500 dark:text-slate-400">
        Checking reviewer access…
      </p>
    )
  }

  if (!canReview) {
    return (
      <div className="rounded-lg bg-zinc-100 p-3 dark:bg-slate-800/60">
        <p className="mb-2 text-sm text-zinc-700 dark:text-slate-200">
          Volunteer as a reviewer in Settings to review tasks.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigateInHostApp('/settings')}
        >
          Open Settings
        </Button>
      </div>
    )
  }

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
    void runAction(() => startTaskReview<ReviewTask>(task.id), 'Task locked for review')
  }

  const handleCancelClaim = () => {
    void runAction(() => cancelTaskReview<ReviewTask>(task.id), 'Task unlocked')
  }

  const openReviewModal = async (status: number, label: string) => {
    setPendingReview({ status, label })
    setReviewModalOpen(true)
    setNextTaskType('random')
    setSelectedNearbyTaskId(null)
    setReviewSubmitted(false)
    setIsLastReviewTask(false)
    setIsLoadingContinuation(true)
    setContinuationError(null)
    if (!reviewChallengeId) {
      setNearbyTasks([])
      setIsLoadingContinuation(false)
      return
    }

    const [nearbyResult, progressResult] = await Promise.allSettled([
      fetchNearbyChallengeReviews<ReviewTask[]>(task.id, reviewChallengeId),
      fetchChallengeReviewProgress(reviewChallengeId),
    ])

    if (nearbyResult.status === 'fulfilled') {
      setNearbyTasks(
        nearbyResult.value.filter((nearbyTask) => nearbyTask.id !== task.id)
      )
    } else {
      setNearbyTasks([])
      setContinuationError('Unable to load nearby review tasks.')
    }
    if (progressResult.status === 'fulfilled') {
      setIsLastReviewTask(progressResult.value.remaining <= 1)
    }
    setIsLoadingContinuation(false)
  }

  const completeReview = async () => {
    if (!pendingReview || !reviewChallengeId) return
    setIsLoadingContinuation(true)
    setContinuationError(null)
    if (!reviewSubmitted) {
      try {
        const updatedTask = await updateTaskReviewStatus<ReviewTask>({
          taskId: task.id,
          reviewStatus: pendingReview.status,
          comment,
        })
        setTask(updatedTask)
        setReviewSubmitted(true)
      } catch {
        setContinuationError('Unable to submit this review. Please try again.')
        setIsLoadingContinuation(false)
        return
      }
    }

    if (isLastReviewTask) {
      setReviewModalOpen(false)
      navigateInHostApp(`/challenge/${reviewChallengeId}`)
      setIsLoadingContinuation(false)
      return
    }

    try {
      const nextTask =
        nextTaskType === 'nearby' && selectedNearbyTaskId
          ? await startTaskReview<ReviewTask>(selectedNearbyTaskId)
          : await fetchNextChallengeReview<ReviewTask>(reviewChallengeId)
      setReviewModalOpen(false)
      navigateInHostApp(
        `/tasks/${nextTask.id}?review=true&reviewChallengeId=${reviewChallengeId}`
      )
    } catch (err) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'status' in err.response
          ? err.response.status
          : undefined
      if (status === 404) {
        setReviewModalOpen(false)
        navigateInHostApp(`/challenge/${reviewChallengeId}`)
      } else {
        setContinuationError('Unable to load the next review task. Please try again.')
      }
    } finally {
      setIsLoadingContinuation(false)
    }
  }

  const mapCurrentTask: PluginTaskMapItem | null =
    reviewChallengeId && task.location
      ? {
          id: task.id,
          parent: reviewChallengeId,
          bundleId: task.bundleId,
          location: task.location,
        }
      : null
  const nearbyMapTasks: PluginTaskMapItem[] = nearbyTasks.flatMap((nearbyTask) => {
    if (!nearbyTask.location) return []
    return [
      {
        id: nearbyTask.id,
        parent: reviewChallengeId ?? 0,
        bundleId: nearbyTask.bundleId,
        location: nearbyTask.location,
      },
    ]
  })

  return (
    <>
      <div className="rounded-lg bg-zinc-100 p-1.5 dark:bg-slate-800/60">
        <div className="mb-1.5 px-1 font-medium text-xs text-zinc-500 uppercase tracking-wider dark:text-slate-400">
          Review
        </div>
        <p className="mb-2 px-1 text-center text-xs text-zinc-600 dark:text-slate-400">
          Current: {formatReviewStatus(reviewFields.reviewStatus)}
          {claimedBy != null && (
            <span className="block">
              {isClaimedByMe ? 'Locked by you' : `Locked by user #${claimedBy}`}
            </span>
          )}
        </p>

        <div className="mb-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isLoading || (claimedBy != null && !isClaimedByMe)}
            onClick={isClaimedByMe ? handleCancelClaim : handleClaim}
            title={isClaimedByMe ? 'Unlock this review task' : 'Lock this task for review'}
          >
            {isClaimedByMe ? (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M9 10V7a4 4 0 0 1 7.5-2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M8 10V7a4 4 0 0 1 8 0v3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {isLoading
              ? isClaimedByMe
                ? 'Unlocking…'
                : 'Locking…'
              : isClaimedByMe
                ? 'Unlock'
                : 'Lock'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="success"
            size="sm"
            disabled={isLoading}
            onClick={() => void openReviewModal(1, 'Approved')}
          >
            Approve
          </Button>
          <Button
            variant="warning"
            size="sm"
            disabled={isLoading}
            onClick={() => void openReviewModal(3, 'Approved with fixes')}
          >
            With fixes
          </Button>
          <Button
            variant="caution"
            size="sm"
            className="col-span-2"
            disabled={isLoading}
            onClick={() => void openReviewModal(2, 'Rejected')}
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

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Task Review</DialogTitle>
            <DialogDescription>
              Add review feedback and choose the next task to review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Review outcome</Label>
              <div className="flex items-center gap-3">
                <Badge
                  variant={getReviewStatusVariant(reviewFields.reviewStatus)}
                  className="px-3 py-2 text-sm"
                >
                  {formatReviewStatus(reviewFields.reviewStatus)}
                </Badge>
                <span className="text-zinc-500">→</span>
                <Badge
                  variant={getReviewStatusVariant(pendingReview?.status)}
                  className="px-3 py-2 text-sm"
                >
                  {pendingReview?.label}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={commentFieldId}>Review comment (optional)</Label>
              <Textarea
                id={commentFieldId}
                rows={4}
                placeholder="Share feedback with the mapper or other reviewers…"
                value={comment}
                onChange={(event: { target: { value: string } }) => setComment(event.target.value)}
              />
            </div>

            {isLastReviewTask ? (
              <Alert>
                <AlertTitle>Last review task</AlertTitle>
                <AlertDescription>
                  This is the last task in this challenge awaiting review. Completing it will return
                  you to the challenge overview.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <Label>Next review task</Label>
                <RadioGroup
                  value={nextTaskType}
                  onValueChange={(value: string) => {
                    setNextTaskType(value as 'random' | 'nearby')
                    if (value === 'random') setSelectedNearbyTaskId(null)
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="random" id={randomReviewId} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={randomReviewId} className="cursor-pointer font-medium">
                          Random high-priority review
                        </Label>
                        <p className="mt-1 text-xs text-zinc-500">
                          Claim the next available review task from this challenge.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem
                        value="nearby"
                        id={nearbyReviewId}
                        className="mt-1"
                        disabled={nearbyMapTasks.length === 0}
                      />
                      <div className="flex-1">
                        <Label htmlFor={nearbyReviewId} className="cursor-pointer font-medium">
                          Nearby review task
                        </Label>
                        <p className="mt-1 text-xs text-zinc-500">
                          Select an available review task near the current one.
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>

                {isLoadingContinuation && (
                  <p className="text-sm text-zinc-500">Loading nearby review tasks…</p>
                )}
                {nextTaskType === 'nearby' && mapCurrentTask && nearbyMapTasks.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-slate-700">
                    <TaskSelectionMap
                      currentTask={mapCurrentTask}
                      tasks={nearbyMapTasks}
                      selectedTaskId={selectedNearbyTaskId}
                      onTaskSelect={setSelectedNearbyTaskId}
                    />
                  </div>
                )}
                {!isLoadingContinuation && nearbyMapTasks.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    No nearby review tasks are available. A random task will be selected.
                  </p>
                )}
              </div>
            )}

            {continuationError && (
              <p className="text-sm text-red-600 dark:text-red-400">{continuationError}</p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setReviewModalOpen(false)} disabled={isLoadingContinuation}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void completeReview()}
              disabled={
                isLoadingContinuation ||
                !pendingReview ||
                !reviewChallengeId ||
                (!isLastReviewTask && nextTaskType === 'nearby' && !selectedNearbyTaskId)
              }
            >
              {isLoadingContinuation
                ? 'Submitting…'
                : isLastReviewTask
                  ? 'Complete & Return to Challenge'
                  : 'Complete & Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

const ReviewChallengeWidget = ({ challenge }: ChallengeActionContext) => {
  const {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    ProgressBar,
    Separator,
    StatCard,
    StatCardGrid,
  } = getHostUi()
  const challengeId = (challenge as { id?: number }).id
  const [metrics, setMetrics] = useState<ChallengeReviewMetrics | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    if (!challengeId) return
    let cancelled = false
    void fetchChallengeReviewProgress(challengeId)
      .then((result) => {
        if (!cancelled) setMetrics(result)
      })
      .catch(() => {
        if (!cancelled) setMetrics(null)
      })
    return () => {
      cancelled = true
    }
  }, [challengeId])

  const percentage =
    metrics && metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0
  const progressSegments =
    metrics && metrics.total > 0
      ? [
          {
            key: 'approved',
            count: metrics.reviewApproved,
            color: '#15803d',
            title: 'Approved',
          },
          {
            key: 'approved-with-fixes',
            count: metrics.reviewAssisted,
            color: '#eab308',
            title: 'Approved With Fixes',
          },
          {
            key: 'rejected',
            count: metrics.reviewRejected,
            color: '#b91c1c',
            title: 'Rejected',
          },
          {
            key: 'disputed',
            count: metrics.reviewDisputed,
            color: '#ea580c',
            title: 'Disputed',
          },
          {
            key: 'requested',
            count: metrics.reviewRequested,
            color: '#2563eb',
            title: 'Awaiting Review',
          },
        ]
          .filter((segment) => segment.count > 0)
          .map((segment) => ({
            key: segment.key,
            percentage: (segment.count / metrics.total) * 100,
            color: segment.color,
            title: `${segment.title}: ${segment.count}`,
          }))
      : []

  const startReviewing = async () => {
    if (!challengeId) return
    setIsStarting(true)
    setStartError(null)
    try {
      const task = await fetchNextChallengeReview<ReviewTask>(challengeId)
      if (!Number.isFinite(task.id)) {
        throw new Error('No review task was returned')
      }
      navigateInHostApp(`/tasks/${task.id}?review=true&reviewChallengeId=${challengeId}`)
    } catch (error) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'status' in error.response
          ? error.response.status
          : undefined
      setStartError(
        status === 404
          ? 'No reviews are currently available for this challenge.'
          : 'Unable to start a challenge review. Please try again.'
      )
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="font-semibold text-zinc-900 dark:text-white">Review Progress</span>
            {metrics && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setDetailsOpen(true)}
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 19V9m6 10V5m6 14v-7m4 7H2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Details
              </Button>
            )}
          </div>
          <span
            className="font-bold text-base text-zinc-900 dark:text-white"
            title={
              metrics
                ? `${metrics.completed} of ${metrics.total} reviews complete; ${metrics.remaining} remaining`
                : 'Loading review progress'
            }
          >
            {percentage}%
          </span>
        </div>
        <ProgressBar segments={progressSegments} percentage={percentage} />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Button
          size="lg"
          className="w-full gap-2 rounded-full bg-teal-600 text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-md"
          onClick={() => void startReviewing()}
          disabled={isStarting}
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m6 4 14 8-14 8V4Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {isStarting ? 'Loading...' : 'Review Challenge'}
        </Button>
        {startError && (
          <p className="text-center text-red-600 text-xs dark:text-red-400">{startError}</p>
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Review Activity</DialogTitle>
          </DialogHeader>
          {metrics && (
            <div className="space-y-4">
              <StatCardGrid className="grid-cols-2 sm:grid-cols-2">
                <StatCard
                  tone="info"
                  size="sm"
                  label="Awaiting Review"
                  value={metrics.reviewRequested}
                />
                <StatCard
                  tone="success"
                  size="sm"
                  label="Approved"
                  value={metrics.reviewApproved}
                />
                <StatCard
                  tone="danger"
                  size="sm"
                  label="Rejected"
                  value={metrics.reviewRejected}
                />
                <StatCard
                  tone="warning"
                  size="sm"
                  label="Approved With Fixes"
                  value={metrics.reviewAssisted}
                />
                <StatCard
                  tone="warning"
                  size="sm"
                  label="Disputed"
                  value={metrics.reviewDisputed}
                />
              </StatCardGrid>
              <Separator />
              <div className="flex items-center justify-between px-1">
                <span className="font-semibold text-sm text-zinc-900 dark:text-white">Total</span>
                <span className="font-bold text-base text-zinc-900 dark:text-white">
                  {metrics.total}
                </span>
              </div>
              {metrics.avgReviewTime > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm text-zinc-600 dark:text-slate-400">
                      Average Review Time
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {Math.round(metrics.avgReviewTime)}s
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

const ReviewChallengeFooter = ({
  challenge,
  user,
  mapContent,
}: ChallengeActionContext & { mapContent: ReactNode }) => {
  const { Tabs, TabsContent, TabsList, TabsTrigger } = getHostUi()
  const pluginUser =
    user && typeof (user as PluginUser).id === 'number'
      ? (user as PluginUser)
      : null

  // Non-reviewers only see the native map / start-challenge footer.
  if (!isCurrentUserReviewer(pluginUser)) {
    return <>{mapContent}</>
  }

  return (
    <Tabs defaultValue="review">
      <TabsList className="w-full">
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="review">Review</TabsTrigger>
      </TabsList>
      <TabsContent value="map">{mapContent}</TabsContent>
      <TabsContent value="review">
        <ReviewChallengeWidget challenge={challenge} user={pluginUser} />
      </TabsContent>
    </Tabs>
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
    hostUser =
      context?.user && typeof context.user.id === 'number'
        ? { id: context.user.id }
        : null
    void loadReviewerStatus()
  },
  getNavigationItems: () => [
    {
      id: 'maproulette-review-nav',
      label: 'Review',
      to: '/review',
      order: 90,
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
  getChallengeFooterExtensions: () => [
    {
      id: 'maproulette-review-challenge-footer',
      order: 10,
      component: ReviewChallengeFooter,
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
