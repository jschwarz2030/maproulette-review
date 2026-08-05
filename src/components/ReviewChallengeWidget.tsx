import { type ReactNode, useEffect, useState } from 'react'
import {
  getHostUi,
  isCurrentUserReviewer,
  navigateInHostApp,
} from '../host'
import {
  type ChallengeReviewMetrics,
  fetchChallengeReviewProgress,
  fetchNextChallengeReview,
} from '../reviewApi'
import type { ChallengeActionContext } from '../pluginTypes'
import type { PluginUser, ReviewTask } from '../types'

export const ReviewChallengeWidget = ({ challenge }: ChallengeActionContext) => {
  const {
    Alert,
    AlertDescription,
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
          <Alert variant="destructive">
            <AlertDescription>{startError}</AlertDescription>
          </Alert>
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

export const ReviewChallengeFooter = ({
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
