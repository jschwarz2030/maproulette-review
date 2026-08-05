import { getHostUi } from '../host'
import { useResolvedErrorTagNames } from './ErrorTagPicker'
import {
  formatReviewStatus,
  getReviewFields,
  getReviewStatusVariant,
  isRejectedForMapperRevision,
} from '../lib/reviewStatus'
import type { ReviewTask } from '../types'

/** Compact review-status indicator above host completion actions for rejected tasks. */
export const MapperRevisionActionsPanel = ({ task: taskProp }: { task: unknown }) => {
  const { Badge } = getHostUi()
  const task = taskProp as ReviewTask

  if (!isRejectedForMapperRevision(task)) {
    return null
  }

  const reviewStatus = getReviewFields(task).reviewStatus
  const errorTagNames = useResolvedErrorTagNames(task.errorTags)

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1">
      <span className="font-medium text-xs text-zinc-500 uppercase tracking-wider dark:text-slate-400">
        Review
      </span>
      <Badge variant={getReviewStatusVariant(reviewStatus)}>
        {formatReviewStatus(reviewStatus)}
      </Badge>
      {errorTagNames.map((name) => (
        <Badge key={name} variant="destructive" className="text-[10px]">
          {name}
        </Badge>
      ))}
    </div>
  )
}

export const isMapperRevisionPanelActive = (context: {
  search: Record<string, unknown>
  task: unknown
}): boolean => {
  const review = context.search.review
  if (review === true || review === 'true' || review === '1') return false
  return isRejectedForMapperRevision(context.task)
}
