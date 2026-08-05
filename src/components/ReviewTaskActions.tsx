import { useEffect, useId, useState } from 'react'
import {
  getHostUi,
  getHostUser,
  isCurrentUserReviewer,
  loadReviewerStatus,
  navigateInHostApp,
} from '../host'
import { ErrorTagPicker } from './ErrorTagPicker'
import {
  cancelTaskReview,
  fetchChallengeRequireRejectReason,
  fetchChallengeReviewProgress,
  fetchNearbyChallengeReviews,
  fetchNextChallengeReview,
  startTaskReview,
  updateTaskReviewStatus,
} from '../reviewApi'
import {
  formatReviewStatus,
  getReviewFields,
  getReviewLock,
  getReviewStatusVariant,
} from '../lib/reviewStatus'
import {
  ERROR_TAG_REVIEW_STATUSES,
  parseErrorTagIds,
  serializeErrorTagIds,
} from '../lib/errorTags'
import type { PluginTaskMapItem, ReviewTask } from '../types'

export const ReviewTaskActionsPanel = ({
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
    Card,
    CardContent,
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
  const [errorTagIds, setErrorTagIds] = useState<number[]>([])
  const [requireRejectReason, setRequireRejectReason] = useState(false)
  const [canReview, setCanReview] = useState<boolean | null>(() =>
    isCurrentUserReviewer() ? true : null
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
  const myId = getHostUser()?.id ?? null
  const lock = getReviewLock(task, myId)
  const claimedBy = lock?.claimedById ?? null
  const isClaimedByMe = lock?.isMine ?? false
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
      <Alert>
        <AlertTitle>Reviewer access required</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>Volunteer as a reviewer in Settings to review tasks.</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigateInHostApp('/settings')}
          >
            Open Settings
          </Button>
        </AlertDescription>
      </Alert>
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
    setErrorTagIds(parseErrorTagIds(task.errorTags))
    setIsLoadingContinuation(true)
    setContinuationError(null)
    if (!reviewChallengeId) {
      setNearbyTasks([])
      setRequireRejectReason(false)
      setIsLoadingContinuation(false)
      return
    }

    const [nearbyResult, progressResult, requireReasonResult] = await Promise.allSettled([
      fetchNearbyChallengeReviews<ReviewTask[]>(task.id, reviewChallengeId),
      fetchChallengeReviewProgress(reviewChallengeId),
      fetchChallengeRequireRejectReason(reviewChallengeId),
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
    setRequireRejectReason(
      requireReasonResult.status === 'fulfilled' ? requireReasonResult.value : false
    )
    setIsLoadingContinuation(false)
  }

  const completeReview = async () => {
    if (!pendingReview || !reviewChallengeId) return
    const needsErrorTags = ERROR_TAG_REVIEW_STATUSES.has(pendingReview.status)
    if (needsErrorTags && requireRejectReason && errorTagIds.length === 0) {
      setContinuationError('This challenge requires at least one error code.')
      return
    }
    setIsLoadingContinuation(true)
    setContinuationError(null)
    if (!reviewSubmitted) {
      try {
        const updatedTask = await updateTaskReviewStatus<ReviewTask>({
          taskId: task.id,
          reviewStatus: pendingReview.status,
          comment,
          errorTags: needsErrorTags ? serializeErrorTagIds(errorTagIds) : undefined,
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
      <Card className="border-0 bg-zinc-100 shadow-none dark:bg-slate-800/60">
        <CardContent className="p-1.5">
          <div className="mb-1.5 px-1 font-medium text-xs text-zinc-500 uppercase tracking-wider dark:text-slate-400">
            Review
          </div>
          <p className="mb-2 px-1 text-center text-xs text-zinc-600 dark:text-slate-400">
            Current: {formatReviewStatus(reviewFields.reviewStatus)}
            {lock && <span className="block">{lock.label}</span>}
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
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        </CardContent>
      </Card>

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

            {pendingReview && ERROR_TAG_REVIEW_STATUSES.has(pendingReview.status) && (
              <ErrorTagPicker
                selectedIds={errorTagIds}
                onChange={setErrorTagIds}
                required={requireRejectReason}
              />
            )}

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
                  <Card>
                    <CardContent className="p-3">
                      <TaskSelectionMap
                        currentTask={mapCurrentTask}
                        tasks={nearbyMapTasks}
                        selectedTaskId={selectedNearbyTaskId}
                        onTaskSelect={setSelectedNearbyTaskId}
                      />
                    </CardContent>
                  </Card>
                )}
                {!isLoadingContinuation && nearbyMapTasks.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    No nearby review tasks are available. A random task will be selected.
                  </p>
                )}
              </div>
            )}

            {continuationError && (
              <Alert variant="destructive">
                <AlertDescription>{continuationError}</AlertDescription>
              </Alert>
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
                (!isLastReviewTask && nextTaskType === 'nearby' && !selectedNearbyTaskId) ||
                (Boolean(pendingReview) &&
                  ERROR_TAG_REVIEW_STATUSES.has(pendingReview.status) &&
                  requireRejectReason &&
                  errorTagIds.length === 0)
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
