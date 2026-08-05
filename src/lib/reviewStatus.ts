import type {
  MapperActivityFilter,
  MapperFilter,
  ReviewStatusFilter,
  ReviewTask,
  TaskReviewFields,
} from '../types'

/** Rejected — mapper must revise and resubmit. */
export const MAPPER_REVISION_STATUSES = new Set([2])

/** Rejected / Disputed — shown as revision-related in filters and flags. */
export const NEEDS_REVISION_STATUSES = new Set([2, 4])

/** Waiting for a reviewer. */
export const AWAITING_REVIEW_STATUSES = new Set([0])

/** Terminal / positive outcomes from the mapper's perspective. */
export const RESOLVED_STATUSES = new Set([1, 3, 5, 6, 7])

export const REVIEW_STATUS_LABELS: Record<number, string> = {
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

export const getReviewFields = (task: ReviewTask): TaskReviewFields =>
  task.review ?? {
    reviewStatus: (task as { reviewStatus?: number | null }).reviewStatus,
    reviewClaimedBy: (task as { reviewClaimedBy?: number | null }).reviewClaimedBy,
    reviewClaimedByUsername: (task as { reviewClaimedByUsername?: string | null })
      .reviewClaimedByUsername,
    reviewRequestedBy: (task as { reviewRequestedBy?: number | null }).reviewRequestedBy,
    reviewedBy: (task as { reviewedBy?: number | null }).reviewedBy,
  }

/** Who holds the review claim lock, if any. */
export const getReviewLock = (
  task: ReviewTask,
  currentUserId: number | null
): { claimedById: number; label: string; isMine: boolean } | null => {
  const fields = getReviewFields(task)
  const claimedById = fields.reviewClaimedBy ?? null
  if (claimedById == null) return null

  const isMine = currentUserId != null && claimedById === currentUserId
  const username = fields.reviewClaimedByUsername?.trim()
  const who = isMine ? 'you' : username && username.length > 0 ? username : `#${claimedById}`

  return {
    claimedById,
    isMine,
    label: `Locked by ${who}`,
  }
}

export const formatReviewStatus = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'Not set'
  return REVIEW_STATUS_LABELS[value] ?? `Status ${value}`
}

export const getReviewStatusVariant = (
  status?: number | null
): 'secondary' | 'success' | 'destructive' | 'warning' | 'caution' | 'outline' | 'info' => {
  switch (status) {
    case 0:
      return 'info'
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

export const isNeedsRevision = (task: ReviewTask): boolean => {
  const status = getReviewFields(task).reviewStatus
  return status != null && NEEDS_REVISION_STATUSES.has(status)
}

/** Rejected only — unlocks mapper redo / revision UI (matches mr3-main). */
export const isRejectedForMapperRevision = (task: unknown): boolean => {
  const asTask = task as ReviewTask
  const status = getReviewFields(asTask).reviewStatus
  return status != null && MAPPER_REVISION_STATUSES.has(status)
}

export const isAwaitingReview = (task: ReviewTask): boolean => {
  const status = getReviewFields(task).reviewStatus
  return status != null && AWAITING_REVIEW_STATUSES.has(status)
}

export const isResolved = (task: ReviewTask): boolean => {
  const status = getReviewFields(task).reviewStatus
  return status != null && RESOLVED_STATUSES.has(status)
}

/** Previously reviewed by this user and now requested again (re-review). */
export const isReReviewForUser = (task: ReviewTask, userId: number | null): boolean => {
  if (userId == null) return false
  const fields = getReviewFields(task)
  return fields.reviewStatus === 0 && fields.reviewedBy === userId
}

export const challengeName = (task: ReviewTask): string => {
  if (typeof task.parent === 'object' && task.parent?.name) {
    return `${task.parent.name} (#${task.parent.id || 'n/a'})`
  }
  if (typeof task.parent === 'number') {
    return `Challenge #${task.parent}`
  }
  return 'n/a'
}

export const challengeId = (task: ReviewTask): number | null => {
  if (typeof task.parent === 'object' && typeof task.parent?.id === 'number') {
    return task.parent.id
  }
  if (typeof task.parent === 'number') {
    return task.parent
  }
  return null
}

const mappedOnTime = (task: ReviewTask): number => {
  if (!task.mappedOn) return 0
  const t = Date.parse(task.mappedOn)
  return Number.isFinite(t) ? t : 0
}

/** Needs-revision / re-review first, then newest mappedOn. */
export const sortTasksForDashboard = (
  tasks: ReviewTask[],
  options: { prioritizeNeedsRevision?: boolean; prioritizeReReviewForUserId?: number | null } = {}
): ReviewTask[] => {
  const { prioritizeNeedsRevision = false, prioritizeReReviewForUserId = null } = options
  return [...tasks].sort((a, b) => {
    if (prioritizeNeedsRevision) {
      const aNeeds = isNeedsRevision(a) ? 0 : 1
      const bNeeds = isNeedsRevision(b) ? 0 : 1
      if (aNeeds !== bNeeds) return aNeeds - bNeeds
    }
    if (prioritizeReReviewForUserId != null) {
      const aRe = isReReviewForUser(a, prioritizeReReviewForUserId) ? 0 : 1
      const bRe = isReReviewForUser(b, prioritizeReReviewForUserId) ? 0 : 1
      if (aRe !== bRe) return aRe - bRe
    }
    return mappedOnTime(b) - mappedOnTime(a)
  })
}

export const filterByReviewStatus = (
  tasks: ReviewTask[],
  filter: ReviewStatusFilter
): ReviewTask[] => {
  switch (filter) {
    case 'needsRevision':
      return tasks.filter(isNeedsRevision)
    case 'awaitingReview':
      return tasks.filter(isAwaitingReview)
    case 'resolved':
      return tasks.filter(isResolved)
    default:
      return tasks
  }
}

/** @deprecated Prefer filterByReviewStatus */
export const filterMapperTasks = (tasks: ReviewTask[], filter: MapperFilter): ReviewTask[] =>
  filterByReviewStatus(tasks, filter)

export const filterMapperActivity = (
  tasks: ReviewTask[],
  filter: MapperActivityFilter
): ReviewTask[] => filterByReviewStatus(tasks, filter)

/** Tasks that need the mapper to revise (rejected). Disputed waits on a reviewer. */
export const getMapperActionItems = (tasks: ReviewTask[]): ReviewTask[] =>
  sortTasksForDashboard(tasks.filter(isRejectedForMapperRevision), {
    prioritizeNeedsRevision: true,
  })

export const getAdjacentTask = (
  tasks: ReviewTask[],
  currentId: number | null,
  direction: 'prev' | 'next'
): ReviewTask | null => {
  if (tasks.length === 0) return null
  if (currentId == null) return tasks[0] ?? null
  const idx = tasks.findIndex((t) => t.id === currentId)
  if (idx < 0) return tasks[0] ?? null
  if (direction === 'next') {
    return tasks[idx + 1] ?? null
  }
  return tasks[idx - 1] ?? null
}

export const getNextActionTask = (
  tasks: ReviewTask[],
  currentId: number | null
): ReviewTask | null => getAdjacentTask(getMapperActionItems(tasks), currentId, 'next')

export const parseReviewTasks = (response: unknown): ReviewTask[] => {
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
