import { getHostUi } from '../host'
import { useResolvedErrorTagNames } from './ErrorTagPicker'
import {
  formatReviewStatus,
  getReviewStatusVariant,
} from '../lib/reviewStatus'

/** Mirrors host PluginTaskHistoryItem — kept local so the plugin builds standalone. */
export type ReviewHistoryItemData = {
  taskId: number
  timestamp: string
  actionType: number
  user?: { id: number; username: string } | null
  startedAt?: string
  reviewStatus?: number | null
  reviewRequestedBy?: { id: number; username: string } | null
  reviewedBy?: { id: number; username: string } | null
  metaReviewRequestedBy?: { id: number; username: string } | null
  errorTags?: string | null
}

const ACTION_REVIEW = 2
const ACTION_META_REVIEW = 4

const REVIEW_TINT: Record<number, string> = {
  0: 'from-blue-100/80 dark:from-blue-900/30',
  1: 'from-green-100/80 dark:from-green-900/30',
  2: 'from-red-100/80 dark:from-red-900/30',
  3: 'from-amber-100/80 dark:from-amber-900/30',
  4: 'from-orange-100/80 dark:from-orange-900/30',
  5: 'from-zinc-100/80 dark:from-zinc-800/30',
  6: 'from-green-100/80 dark:from-green-900/30',
  7: 'from-amber-100/80 dark:from-amber-900/30',
}

const REVIEW_BAR: Record<number, string> = {
  0: 'bg-blue-500',
  1: 'bg-green-500',
  2: 'bg-red-500',
  3: 'bg-amber-500',
  4: 'bg-orange-500',
  5: 'bg-zinc-400',
  6: 'bg-green-500',
  7: 'bg-amber-500',
}

const formatShortDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const actorUsername = (item: ReviewHistoryItemData): string => {
  const status = item.reviewStatus
  if (status === 0 || status === 4) {
    return (
      item.reviewRequestedBy?.username ??
      item.metaReviewRequestedBy?.username ??
      item.user?.username ??
      'System'
    )
  }
  return (
    item.reviewedBy?.username ??
    item.reviewRequestedBy?.username ??
    item.user?.username ??
    'System'
  )
}

export const canRenderReviewHistoryItem = (item: ReviewHistoryItemData): boolean =>
  item.actionType === ACTION_REVIEW || item.actionType === ACTION_META_REVIEW

/**
 * Review / meta-review row for the host comments/history tab.
 */
export const ReviewHistoryItem = ({
  item,
  index,
}: {
  item: ReviewHistoryItemData
  index: number
}) => {
  const { Badge } = getHostUi()
  const isMeta = item.actionType === ACTION_META_REVIEW
  const status = item.reviewStatus ?? undefined
  const tint = status != null ? REVIEW_TINT[status] : REVIEW_TINT[5]
  const bar = status != null ? REVIEW_BAR[status] : REVIEW_BAR[5]
  const username = actorUsername(item)
  const title = item.timestamp ? new Date(item.timestamp).toLocaleString() : undefined
  const errorTagNames = useResolvedErrorTagNames(item.errorTags)

  return (
    <div
      key={`review-${item.timestamp}-${index}`}
      title={title}
      className={`relative flex flex-wrap items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r to-transparent py-2 pr-3 pl-4 text-xs ${tint}`}
    >
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${bar}`} />
      {isMeta && (
        <span className="font-medium text-[10px] text-zinc-500 uppercase tracking-wide dark:text-slate-400">
          Meta
        </span>
      )}
      <span className="font-medium text-zinc-700 dark:text-slate-200">{username}</span>
      {status != null ? (
        <Badge variant={getReviewStatusVariant(status)} className="text-[11px]">
          {formatReviewStatus(status)}
        </Badge>
      ) : (
        <span className="text-zinc-500 dark:text-slate-400">updated review</span>
      )}
      {item.startedAt && (
        <span className="text-zinc-400 dark:text-slate-500">
          started {formatShortDate(item.startedAt)}
        </span>
      )}
      {errorTagNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {errorTagNames.map((name) => (
            <Badge key={name} variant="destructive" className="text-[10px]">
              {name}
            </Badge>
          ))}
        </div>
      )}
      <span className="ml-auto text-zinc-400 dark:text-slate-500">
        {formatShortDate(item.timestamp)}
      </span>
    </div>
  )
}
