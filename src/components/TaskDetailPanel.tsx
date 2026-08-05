import { useEffect, useState } from 'react'
import { getHostUi, navigateInHostApp } from '../host'
import { challengeId } from '../lib/reviewStatus'
import { fetchTask } from '../reviewApi'
import type { PluginTaskMapItem, ReviewTask } from '../types'

type TaskDetailPanelProps = {
  task: ReviewTask | null
  onClose: () => void
  isReviewer: boolean
  currentUserId: number | null
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

const toMapItem = (task: ReviewTask): PluginTaskMapItem | null => {
  const parentId = challengeId(task)
  if (parentId == null || !task.location?.coordinates) return null
  return {
    id: task.id,
    parent: parentId,
    bundleId: task.bundleId ?? null,
    location: { coordinates: task.location.coordinates },
  }
}

const priorityMeta = (
  priority: number | undefined
): { label: string; variant: 'destructive' | 'warning' | 'success'; dot: string } | null => {
  if (priority === 0) {
    return { label: 'High', variant: 'destructive', dot: 'bg-red-400' }
  }
  if (priority === 1) {
    return { label: 'Medium', variant: 'warning', dot: 'bg-amber-300' }
  }
  if (priority === 2) {
    return { label: 'Low', variant: 'success', dot: 'bg-emerald-300' }
  }
  return null
}

/**
 * Docked task preview — only shows data that isn't already in the table row.
 */
export const TaskDetailPanel = ({
  task,
  onClose,
  isReviewer,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: TaskDetailPanelProps) => {
  const {
    SidePanelHeader,
    SidePanelTitle,
    SidePanelFooter,
    Button,
    Badge,
    Alert,
    AlertDescription,
    Skeleton,
    Separator,
    TaskSelectionMap,
    CommentsHistoryTab,
  } = getHostUi()

  const [detail, setDetail] = useState<ReviewTask | null>(task)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!task) {
      setDetail(null)
      return
    }

    let cancelled = false
    setDetail(task)
    setLoading(true)
    setError(null)

    void fetchTask(task.id)
      .then((full) => {
        if (!cancelled) setDetail(full)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load task')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [task?.id])

  const active = task && detail?.id === task.id ? detail : task
  const mapItem = active ? toMapItem(active) : null
  const priority = active ? priorityMeta(active.priority) : null

  const openFullTask = () => {
    if (!active) return
    if (isReviewer) {
      navigateInHostApp(`/tasks/${active.id}?review=true`)
    } else {
      navigateInHostApp(`/tasks/${active.id}`)
    }
  }

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-zinc-100 dark:bg-slate-800"
      aria-label="Task preview"
    >
      <SidePanelHeader className="h-10 items-center border-b-0 px-4 py-0">
        <SidePanelTitle className="text-xs font-medium">Preview</SidePanelTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-7 bg-white px-2 text-xs dark:bg-slate-950 dark:hover:bg-slate-900"
          onClick={onClose}
          aria-label="Close preview"
        >
          Close
        </Button>
      </SidePanelHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
        {!active && <p className="text-sm text-zinc-500">Select a task to preview.</p>}

        {active && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div className="min-h-0 flex-[0_0_28%] space-y-2.5 overflow-y-auto pr-1">
              {loading && <Skeleton className="h-16 w-full" />}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {priority && (
                <div className="mt-0.5 mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-500 dark:text-slate-400">
                    Priority
                  </span>
                  <Badge variant={priority.variant} className="gap-1.5 px-2 py-0.5 text-[11px]">
                    <span className={`size-1.5 shrink-0 rounded-full ${priority.dot}`} aria-hidden />
                    {priority.label}
                  </Badge>
                </div>
              )}

              {mapItem && (
                <div className="mt-1 h-28 overflow-hidden rounded-lg border border-zinc-300 shadow-xs dark:border-slate-500">
                  <TaskSelectionMap
                    key={mapItem.id}
                    currentTask={mapItem}
                    tasks={[mapItem]}
                    selectedTaskId={mapItem.id}
                    onTaskSelect={() => {}}
                    showSelectedBadge={false}
                  />
                </div>
              )}
            </div>

            <Separator className="shrink-0 opacity-60" />

            <div className="flex min-h-0 flex-[1_1_72%] flex-col overflow-hidden">
              <CommentsHistoryTab key={active.id} taskId={active.id} readOnly />
            </div>
          </div>
        )}
      </div>

      <SidePanelFooter className="justify-between gap-2 border-zinc-300 bg-white/80 dark:border-slate-600 dark:bg-slate-950/70">
        <Button
          variant="outline"
          className="bg-white dark:bg-slate-900 dark:hover:bg-slate-800"
          disabled={!hasPrev}
          onClick={onPrev}
        >
          Prev
        </Button>
        {active && <Button onClick={openFullTask}>Visit Task</Button>}
        <Button
          variant="outline"
          className="bg-white dark:bg-slate-900 dark:hover:bg-slate-800"
          disabled={!hasNext}
          onClick={onNext}
        >
          Next
        </Button>
      </SidePanelFooter>
    </aside>
  )
}
