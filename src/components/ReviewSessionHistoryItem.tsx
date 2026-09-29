import { getHostUi } from '../host'
import { SESSION_SUB_TYPE_REVIEW, SESSION_TYPE_CUSTOM } from '../lib/sessionHistory'

export type ReviewSessionHistoryItemData = {
  taskId: number
  timestamp: string
  actionType?: number
  user?: { id: number; username: string } | null
  event?: string
  sessionType?: string
  subType?: string | null
}

export const canRenderReviewSessionHistoryItem = (
  item: ReviewSessionHistoryItemData
): boolean =>
  item.sessionType === SESSION_TYPE_CUSTOM &&
  item.subType === SESSION_SUB_TYPE_REVIEW &&
  (item.event === 'lock' || item.event === 'unlock')

const formatShortDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Review lock/unlock row for the host comments/history tab.
 */
export const ReviewSessionHistoryItem = ({
  item,
}: {
  item: ReviewSessionHistoryItemData
  index: number
}) => {
  const { Badge } = getHostUi()
  const username = item.user?.username ?? 'System'
  const isLock = item.event === 'lock'
  const title = item.timestamp ? new Date(item.timestamp).toLocaleString() : undefined
  const tint = isLock ? 'from-teal-100/80 dark:from-teal-900/30' : 'from-zinc-100/80 dark:from-zinc-800/30'
  const bar = isLock ? 'bg-teal-500' : 'bg-zinc-400'

  return (
    <div
      title={title}
      className={`relative flex flex-wrap items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r to-transparent py-2 pr-3 pl-4 text-xs ${tint}`}
    >
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${bar}`} />
      <span className="font-medium text-zinc-700 dark:text-slate-200">{username}</span>
      <Badge variant={isLock ? 'info' : 'secondary'} className="text-[11px]">
        {isLock ? 'Locked for review' : 'Unlocked review'}
      </Badge>
      <span className="ml-auto text-zinc-400 dark:text-slate-500">
        {formatShortDate(item.timestamp)}
      </span>
    </div>
  )
}
