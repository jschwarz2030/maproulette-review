import type { ComponentType, ReactNode } from 'react'
import { getHostUi, navigateInHostApp } from '../host'
import {
  challengeId,
  challengeName,
  formatReviewStatus,
  getReviewFields,
  getReviewLock,
  getReviewStatusVariant,
  isNeedsRevision,
  isReReviewForUser,
} from '../lib/reviewStatus'
import type { MapperActivityFilter, ReviewStatusFilter, ReviewTask } from '../types'

export type SortKey = 'task' | 'challenge' | 'status' | 'mappedOn' | 'flags'
export type SortDir = 'asc' | 'desc'

type ReviewTaskTableProps = {
  tasks: ReviewTask[]
  selectedTaskId: number | null
  /** Open the preview sidebar (used when it is currently closed). */
  onOpenPreview: (task: ReviewTask) => void
  /** Switch the previewed task without re-opening (used when sidebar is already open). */
  onSelectTask: (task: ReviewTask) => void
  previewOpen: boolean
  isReviewer: boolean
  emptyMessage: string
  currentUserId: number | null
  showReReviewBadge?: boolean
  enableStatusFilter?: boolean
  statusFilter?: ReviewStatusFilter
  onStatusFilterChange?: (filter: ReviewStatusFilter) => void
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

const STATUS_FILTERS: Array<{ id: ReviewStatusFilter; label: string }> = [
  { id: 'all', label: 'All statuses' },
  { id: 'needsRevision', label: 'Needs revision' },
  { id: 'awaitingReview', label: 'Awaiting review' },
  { id: 'resolved', label: 'Resolved' },
]

const SortableHead = ({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  TableHead,
  children,
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  TableHead: ComponentType<Record<string, unknown>>
  children?: ReactNode
}) => {
  const active = sortKey === column
  const indicator = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <TableHead>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="inline-flex items-center border-0 bg-transparent p-0 font-medium text-xs text-inherit"
          onClick={(event: { stopPropagation: () => void }) => {
            event.stopPropagation()
            onSort(column)
          }}
        >
          {label}
          {indicator}
        </button>
        {children}
      </div>
    </TableHead>
  )
}

const TableLink = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <a
    href={href}
    className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
    onClick={(event: {
      stopPropagation: () => void
      preventDefault: () => void
      metaKey: boolean
      ctrlKey: boolean
      shiftKey: boolean
      altKey: boolean
    }) => {
      event.stopPropagation()
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigateInHostApp(href)
    }}
  >
    {children}
  </a>
)

export const compareReviewTasks = (
  a: ReviewTask,
  b: ReviewTask,
  key: SortKey,
  dir: SortDir,
  options?: { currentUserId?: number | null }
): number => {
  const mult = dir === 'asc' ? 1 : -1
  const mappedOnTime = (task: ReviewTask): number => {
    if (!task.mappedOn) return 0
    const t = Date.parse(task.mappedOn)
    return Number.isFinite(t) ? t : 0
  }

  switch (key) {
    case 'task':
      return (a.id - b.id) * mult
    case 'challenge':
      return challengeName(a).localeCompare(challengeName(b)) * mult
    case 'status': {
      const as = getReviewFields(a).reviewStatus ?? -999
      const bs = getReviewFields(b).reviewStatus ?? -999
      return (as - bs) * mult
    }
    case 'mappedOn':
      return (mappedOnTime(a) - mappedOnTime(b)) * mult
    case 'flags': {
      const flagRank = (task: ReviewTask): number => {
        if (isNeedsRevision(task)) return 0
        if (isReReviewForUser(task, options?.currentUserId ?? null)) return 1
        if (getReviewLock(task, options?.currentUserId ?? null)) return 2
        return 3
      }
      return (flagRank(a) - flagRank(b)) * mult
    }
    default:
      return 0
  }
}

export const ReviewTaskTable = ({
  tasks,
  selectedTaskId,
  onOpenPreview,
  onSelectTask,
  previewOpen,
  isReviewer,
  emptyMessage,
  currentUserId,
  showReReviewBadge = false,
  enableStatusFilter = false,
  statusFilter = 'all',
  onStatusFilterChange,
  sortKey,
  sortDir,
  onSort,
}: ReviewTaskTableProps) => {
  const {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Badge,
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    Select,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectItem,
  } = getHostUi()

  const statusFilterControl = enableStatusFilter && onStatusFilterChange && (
    <Select
      value={statusFilter}
      onValueChange={(value) => onStatusFilterChange(value as ReviewStatusFilter)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Filter by status"
        className="h-7 max-w-[9.5rem] gap-1 px-2 text-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_FILTERS.map((filter) => (
          <SelectItem key={filter.id} value={filter.id}>
            {filter.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (tasks.length === 0) {
    return (
      <div className="space-y-3">
        {enableStatusFilter && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm text-zinc-600 dark:text-slate-400">Status</span>
            {statusFilterControl}
          </div>
        )}
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No tasks</EmptyTitle>
            <EmptyDescription>{emptyMessage}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead
            label="Task"
            column="task"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            TableHead={TableHead}
          />
          <SortableHead
            label="Challenge"
            column="challenge"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            TableHead={TableHead}
          />
          <SortableHead
            label="Status"
            column="status"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            TableHead={TableHead}
          >
            {statusFilterControl}
          </SortableHead>
          <SortableHead
            label="Mapped On"
            column="mappedOn"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            TableHead={TableHead}
          />
          <SortableHead
            label="Flags"
            column="flags"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            TableHead={TableHead}
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const fields = getReviewFields(task)
          const selected = previewOpen && selectedTaskId === task.id
          const needsRevision = isNeedsRevision(task)
          const reReview = showReReviewBadge && isReReviewForUser(task, currentUserId)
          const lock = getReviewLock(task, currentUserId)
          const parentId = challengeId(task)
          const taskHref = isReviewer ? `/tasks/${task.id}?review=true` : `/tasks/${task.id}`
          const challengeHref = parentId != null ? `/challenge/${parentId}` : null

          const activateRow = () => {
            if (previewOpen) onSelectTask(task)
            else onOpenPreview(task)
          }

          return (
            <TableRow
              key={task.id}
              data-state={selected ? 'selected' : undefined}
              role="button"
              tabIndex={0}
              className={
                selected
                  ? 'cursor-pointer border-zinc-200/80 bg-zinc-100 shadow-[inset_3px_0_0_0_#0d9488] outline-none hover:bg-zinc-100 focus:outline-none focus-visible:outline-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-[inset_3px_0_0_0_#2dd4bf] dark:hover:bg-slate-800'
                  : 'cursor-pointer outline-none focus:outline-none focus-visible:outline-none'
              }
              onClick={activateRow}
              onKeyDown={(event: { key: string; preventDefault: () => void }) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  activateRow()
                }
              }}
            >
              <TableCell>
                <TableLink href={taskHref}>#{task.id}</TableLink>
              </TableCell>
              <TableCell>
                {challengeHref ? (
                  <TableLink href={challengeHref}>{challengeName(task)}</TableLink>
                ) : (
                  challengeName(task)
                )}
              </TableCell>
              <TableCell>
                <Badge variant={getReviewStatusVariant(fields.reviewStatus)}>
                  {formatReviewStatus(fields.reviewStatus)}
                </Badge>
              </TableCell>
              <TableCell>{task.mappedOn || 'n/a'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {needsRevision && <Badge variant="destructive">Needs revision</Badge>}
                  {reReview && <Badge variant="caution">Re-review</Badge>}
                  {lock && (
                    <Badge variant={lock.isMine ? 'info' : 'secondary'} title={lock.label}>
                      {lock.label}
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
