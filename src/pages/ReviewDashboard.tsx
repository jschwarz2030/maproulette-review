import { useEffect, useMemo, useRef, useState } from 'react'
import {
  compareReviewTasks,
  ReviewTaskTable,
  type SortDir,
  type SortKey,
} from '../components/ReviewTaskTable'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import {
  getHostUi,
  getHostUser,
  isCurrentUserReviewer,
  loadReviewerStatus,
} from '../host'
import {
  filterByReviewStatus,
  getAdjacentTask,
  getMapperActionItems,
  isNeedsRevision,
  isReReviewForUser,
  sortTasksForDashboard,
} from '../lib/reviewStatus'
import {
  fetchMapperReviewTasks,
  fetchMyReviewedTasks,
  fetchTasksToReview,
} from '../reviewApi'
import type {
  MapperViewMode,
  ReviewerTab,
  ReviewStatusFilter,
  ReviewTask,
  RouteParams,
} from '../types'

/** Approximate heights used to fit rows in the viewport without scrolling. */
const TABLE_HEADER_HEIGHT = 44
const TABLE_ROW_HEIGHT = 49
const PAGINATION_BAR_HEIGHT = 36
const LIST_VERTICAL_GAP = 12
const MIN_PAGE_SIZE = 3
const FALLBACK_PAGE_SIZE = 10

export const ReviewDashboard = (_props: { params?: RouteParams }) => {
  const {
    Button,
    Alert,
    AlertDescription,
    Skeleton,
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    Tabs,
    TabsList,
    TabsTrigger,
  } = getHostUi()

  const [isReviewer, setIsReviewer] = useState(() => isCurrentUserReviewer())
  const [userId, setUserId] = useState<number | null>(() => getHostUser()?.id ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<ReviewTask[]>([])
  const [mapperMode, setMapperMode] = useState<MapperViewMode>('needsAction')
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('mappedOn')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [reviewerTab, setReviewerTab] = useState<ReviewerTab>('toReview')
  const [selected, setSelected] = useState<ReviewTask | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMounted, setPanelMounted] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(FALLBACK_PAGE_SIZE)
  const listViewportRef = useRef<HTMLDivElement | null>(null)

  const load = async (options?: { quiet?: boolean }): Promise<void> => {
    const quiet = options?.quiet === true
    if (!quiet) {
      setLoading(true)
    }
    setError(null)
    try {
      const reviewer = await loadReviewerStatus()
      setIsReviewer(reviewer)
      const user = getHostUser()
      const uid = user?.id ?? null
      setUserId(uid)

      if (reviewer) {
        const list =
          reviewerTab === 'toReview' ? await fetchTasksToReview() : await fetchMyReviewedTasks()
        setTasks(
          sortTasksForDashboard(list, {
            prioritizeReReviewForUserId: reviewerTab === 'toReview' ? uid : null,
          })
        )
      } else {
        if (uid == null) {
          setTasks([])
        } else {
          const list = await fetchMapperReviewTasks(uid)
          setTasks(sortTasksForDashboard(list, { prioritizeNeedsRevision: true }))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review tasks')
      if (!quiet) {
        setTasks([])
      }
    } finally {
      if (!quiet) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void load()
  }, [reviewerTab])

  useEffect(() => {
    if (isReviewer) return
    const refresh = () => {
      void load({ quiet: true })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isReviewer, reviewerTab])

  const actionItems = useMemo(() => getMapperActionItems(tasks), [tasks])
  const actionCount = actionItems.length

  useEffect(() => {
    if (isReviewer || mapperMode !== 'needsAction' || !panelOpen || !selected) return
    if (isNeedsRevision(selected)) {
      const fresh = actionItems.find((t) => t.id === selected.id)
      if (fresh && fresh !== selected) setSelected(fresh)
      return
    }
    const next = actionItems[0] ?? null
    if (next) {
      setSelected(next)
    } else {
      setPanelOpen(false)
    }
  }, [tasks, isReviewer, mapperMode, panelOpen, selected?.id, actionItems])

  const visibleTasks = useMemo(() => {
    let list: ReviewTask[]
    if (isReviewer) {
      list = filterByReviewStatus(tasks, statusFilter)
    } else if (mapperMode === 'needsAction') {
      list = actionItems
    } else {
      list = filterByReviewStatus(tasks, statusFilter)
    }
    return [...list].sort((a, b) =>
      compareReviewTasks(a, b, sortKey, sortDir, { currentUserId: userId })
    )
  }, [tasks, isReviewer, mapperMode, statusFilter, actionItems, sortKey, sortDir, userId])

  useEffect(() => {
    setPage(0)
  }, [isReviewer, mapperMode, statusFilter, reviewerTab, sortKey, sortDir, tasks.length])

  const totalPages = Math.max(1, Math.ceil(visibleTasks.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pageStart = currentPage * pageSize
  const pagedTasks = visibleTasks.slice(pageStart, pageStart + pageSize)
  const rangeStart = visibleTasks.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + pageSize, visibleTasks.length)

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

  const syncPageToTask = (task: ReviewTask) => {
    const index = visibleTasks.findIndex((item) => item.id === task.id)
    if (index < 0) return
    setPage(Math.floor(index / pageSize))
  }

  const reReviewCount = useMemo(
    () => (isReviewer ? tasks.filter((t) => isReReviewForUser(t, userId)).length : 0),
    [tasks, isReviewer, userId]
  )

  const handleOpenPreview = (task: ReviewTask) => {
    setSelected(task)
    if (panelOpen) return
    setPanelMounted(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPanelOpen(true)
      })
    })
  }

  const handleSelectTask = (task: ReviewTask) => {
    setSelected(task)
  }

  const handleClosePanel = () => {
    setPanelOpen(false)
  }

  const handlePanelTransitionEnd = (event: { propertyName: string }) => {
    if (event.propertyName !== 'max-width') return
    if (!panelOpen) {
      setPanelMounted(false)
      setSelected(null)
    }
  }

  const handlePrev = () => {
    const prev = getAdjacentTask(visibleTasks, selected?.id ?? null, 'prev')
    if (!prev) return
    setSelected(prev)
    syncPageToTask(prev)
  }

  const handleNext = () => {
    const next = getAdjacentTask(visibleTasks, selected?.id ?? null, 'next')
    if (!next) return
    setSelected(next)
    syncPageToTask(next)
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'mappedOn' || key === 'task' ? 'desc' : 'asc')
  }

  const selectedIndex =
    selected == null ? -1 : visibleTasks.findIndex((task) => task.id === selected.id)
  const hasPrev = selectedIndex > 0
  const hasNext = selectedIndex >= 0 && selectedIndex < visibleTasks.length - 1

  const noActionsNeeded =
    !isReviewer && !loading && !error && mapperMode === 'needsAction' && actionCount === 0

  const showTaskList = !loading && !error && !noActionsNeeded

  useEffect(() => {
    if (!showTaskList) return
    const viewport = listViewportRef.current
    if (!viewport) return

    const updatePageSize = () => {
      const available =
        viewport.clientHeight -
        TABLE_HEADER_HEIGHT -
        PAGINATION_BAR_HEIGHT -
        LIST_VERTICAL_GAP
      const next = Math.max(MIN_PAGE_SIZE, Math.floor(available / TABLE_ROW_HEIGHT))
      setPageSize((prev) => (prev === next ? prev : next))
    }

    updatePageSize()
    const observer = new ResizeObserver(updatePageSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [showTaskList, panelMounted])

  const toReviewLabel =
    reviewerTab === 'toReview'
      ? reReviewCount > 0
        ? `${tasks.length} to review · ${reReviewCount} re-review`
        : `${tasks.length} to review`
      : 'To review'
  const myReviewsLabel =
    reviewerTab === 'myReviews' ? `${tasks.length} reviewed` : 'My reviews'
  const needsActionLabel =
    actionCount > 0
      ? `${actionCount} need${actionCount === 1 ? 's' : ''} action`
      : 'All clear'

  const emptyMessage = (() => {
    if (statusFilter === 'awaitingReview') return 'No tasks awaiting review.'
    if (statusFilter === 'resolved') return 'No resolved review tasks yet.'
    if (statusFilter === 'needsRevision') return 'No tasks need revision.'
    if (isReviewer) {
      return reviewerTab === 'toReview'
        ? 'No tasks waiting for review.'
        : 'You have not reviewed any tasks yet.'
    }
    return 'No review-related activity found for you.'
  })()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-3 pb-3">
        <h1 className="m-0 text-xl font-semibold text-zinc-900 dark:text-slate-100">Review</h1>

        {isReviewer ? (
          <Tabs
            value={reviewerTab}
            onValueChange={(value: string) => setReviewerTab(value as ReviewerTab)}
          >
            <TabsList>
              <TabsTrigger value="toReview">{toReviewLabel}</TabsTrigger>
              <TabsTrigger value="myReviews">{myReviewsLabel}</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <Tabs
            value={mapperMode}
            onValueChange={(value: string) => setMapperMode(value as MapperViewMode)}
          >
            <TabsList>
              <TabsTrigger value="needsAction">{needsActionLabel}</TabsTrigger>
              <TabsTrigger value="activity">{tasks.length} activity</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden border-zinc-200 border-t bg-white dark:border-slate-700 dark:bg-slate-900">
        <div
          className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${
            panelMounted ? 'flex-1' : 'w-full'
          }`}
        >
          <div
            ref={listViewportRef}
            className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
              panelMounted ? 'py-3 pr-0 pl-4' : 'p-3 pl-4'
            }`}
          >
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!loading && !error && noActionsNeeded && (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>Nothing needs your action</EmptyTitle>
                  <EmptyDescription>
                    You have no tasks waiting on a revision. Browse all activity anytime.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => setMapperMode('activity')}>
                    Browse all activity
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            {showTaskList && (
              <>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ReviewTaskTable
                    tasks={pagedTasks}
                    selectedTaskId={selected?.id ?? null}
                    previewOpen={panelMounted}
                    onOpenPreview={handleOpenPreview}
                    onSelectTask={handleSelectTask}
                    isReviewer={isReviewer}
                    currentUserId={userId}
                    showReReviewBadge={isReviewer && reviewerTab === 'toReview'}
                    enableStatusFilter={isReviewer || mapperMode === 'activity'}
                    statusFilter={statusFilter}
                    onStatusFilterChange={(filter) => {
                      setStatusFilter(filter)
                      setPage(0)
                    }}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    emptyMessage={emptyMessage}
                  />
                </div>

                {visibleTasks.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pt-3 pr-3 text-xs text-zinc-600 dark:text-slate-400">
                    <span>
                      {rangeStart}–{rangeEnd} of {visibleTasks.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 bg-white px-2 dark:bg-slate-950"
                        disabled={currentPage <= 0}
                        onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                      >
                        Previous
                      </Button>
                      <span className="tabular-nums">
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 bg-white px-2 dark:bg-slate-950"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {panelMounted && selected && (
          <div
            className={`h-full min-h-0 shrink-0 overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out ${
              panelOpen
                ? 'w-full max-w-md translate-x-0 opacity-100'
                : 'w-0 max-w-0 translate-x-3 opacity-0'
            }`}
            onTransitionEnd={handlePanelTransitionEnd}
          >
            <div className="flex h-full w-[28rem] max-w-md flex-col overflow-hidden">
              <TaskDetailPanel
                task={selected}
                onClose={handleClosePanel}
                isReviewer={isReviewer}
                currentUserId={userId}
                onPrev={handlePrev}
                onNext={handleNext}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const ReviewedRedirectPage = (props: { params?: RouteParams }) => (
  <ReviewDashboard {...props} />
)
