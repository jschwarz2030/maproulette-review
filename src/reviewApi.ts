import { getHostApiRequest } from './host'
import type { ReviewTask } from './types'
import { parseReviewTasks } from './lib/reviewStatus'

type ApiRequest = NonNullable<ReturnType<typeof getHostApiRequest>>

const getApiRequest = (): ApiRequest => getHostApiRequest()

export const startTaskReview = async <T = unknown>(taskId: number): Promise<T> => {
  const apiRequest = getApiRequest()
  return apiRequest.get(`api/v2/task/${taskId}/review/start`).json<T>()
}

export const cancelTaskReview = async <T = unknown>(taskId: number): Promise<T> => {
  const apiRequest = getApiRequest()
  return apiRequest.get(`api/v2/task/${taskId}/review/cancel`).json<T>()
}

export const updateTaskReviewStatus = async <T = unknown>({
  taskId,
  reviewStatus,
  comment,
  newTaskStatus,
  errorTags,
}: {
  taskId: number
  reviewStatus: number
  comment?: string
  newTaskStatus?: number | null
  errorTags?: string | null
}): Promise<T> => {
  const apiRequest = getApiRequest()
  const trimmed = comment?.trim()
  const params = new URLSearchParams()
  if (newTaskStatus != null) {
    params.set('newTaskStatus', String(newTaskStatus))
  }
  if (errorTags?.trim()) {
    params.set('errorTags', errorTags.trim())
  }
  const query = params.toString()
  const url = `api/v2/task/${taskId}/review/${reviewStatus}${query ? `?${query}` : ''}`
  await apiRequest.put(url, {
    json: { comment: trimmed || '' },
  })
  return apiRequest.get(`api/v2/task/${taskId}?mapillary=false`).json<T>()
}

export const fetchReviewQueue = async <T = unknown>(
  kind: 'toReview' | 'reviewed'
): Promise<T> => {
  const apiRequest = getApiRequest()
  const path =
    kind === 'toReview'
      ? 'api/v2/tasks/review?tStatus=1&limit=200&page=0'
      : 'api/v2/tasks/reviewed?tStatus=1&limit=200&page=0'
  return apiRequest.get(path).json<T>()
}

/** Tasks needing review (reviewer queue). */
export const fetchTasksToReview = async (): Promise<ReviewTask[]> => {
  const apiRequest = getApiRequest()
  const response = await apiRequest
    .get('api/v2/tasks/review?limit=200&page=0&sort=mapped_on&order=DESC')
    .json<unknown>()
  return parseReviewTasks(response)
}

/** Tasks this reviewer has already reviewed. */
export const fetchMyReviewedTasks = async (): Promise<ReviewTask[]> => {
  const apiRequest = getApiRequest()
  const response = await apiRequest
    .get('api/v2/tasks/reviewed?limit=200&page=0&sort=reviewed_at&order=DESC')
    .json<unknown>()
  return parseReviewTasks(response)
}

/**
 * Mapper's own review-related tasks.
 * Backend requires non-reviewers to pass users=<own id>.
 */
export const fetchMapperReviewTasks = async (userId: number): Promise<ReviewTask[]> => {
  const apiRequest = getApiRequest()
  const response = await apiRequest
    .get(
      `api/v2/tasks/reviewed?users=${userId}&allowReviewNeeded=true&limit=200&page=0&sort=mapped_on&order=DESC`
    )
    .json<unknown>()
  return parseReviewTasks(response)
}

export const fetchTask = async (taskId: number): Promise<ReviewTask> => {
  const apiRequest = getApiRequest()
  return apiRequest.get(`api/v2/task/${taskId}?mapillary=false`).json<ReviewTask>()
}

export interface ChallengeReviewMetrics {
  total: number
  reviewRequested: number
  reviewApproved: number
  reviewRejected: number
  reviewAssisted: number
  reviewDisputed: number
  metaReviewRequested: number
  metaReviewApproved: number
  metaReviewRejected: number
  metaReviewAssisted: number
  avgReviewTime: number
  completed: number
  remaining: number
}

export const fetchChallengeReviewProgress = async (
  challengeId: number
): Promise<ChallengeReviewMetrics> => {
  const apiRequest = getApiRequest()
  const metrics = await apiRequest
    .get(`api/v2/tasks/review/metrics?reviewTasksType=4&cid=${challengeId}`)
    .json<Array<Omit<ChallengeReviewMetrics, 'completed' | 'remaining'>>>()
  const reviewMetrics = metrics[0]

  if (!reviewMetrics) {
    return {
      total: 0,
      reviewRequested: 0,
      reviewApproved: 0,
      reviewRejected: 0,
      reviewAssisted: 0,
      reviewDisputed: 0,
      metaReviewRequested: 0,
      metaReviewApproved: 0,
      metaReviewRejected: 0,
      metaReviewAssisted: 0,
      avgReviewTime: 0,
      completed: 0,
      remaining: 0,
    }
  }

  const remaining = reviewMetrics.reviewRequested + reviewMetrics.reviewDisputed
  return {
    ...reviewMetrics,
    completed: Math.max(0, reviewMetrics.total - remaining),
    remaining,
  }
}

export const fetchNextChallengeReview = async <T = unknown>(challengeId: number): Promise<T> => {
  const apiRequest = getApiRequest()
  return apiRequest.get(`api/v2/tasks/review/next?cid=${challengeId}`).json<T>()
}

export const fetchNearbyChallengeReviews = async <T = unknown>(
  taskId: number,
  challengeId: number,
  limit = 5
): Promise<T> => {
  const apiRequest = getApiRequest()
  return apiRequest
    .get(`api/v2/tasks/review/nearby/${taskId}?cid=${challengeId}&limit=${limit}`)
    .json<T>()
}

export const fetchChallengeRequireRejectReason = async (
  challengeId: number
): Promise<boolean> => {
  const apiRequest = getApiRequest()
  try {
    const challenge = await apiRequest
      .get(`api/v2/challenge/${challengeId}`)
      .json<{ requireRejectReason?: boolean | null }>()
    return Boolean(challenge?.requireRejectReason)
  } catch {
    return false
  }
}

const TEST_QUERY = import.meta.env.TEST_QUERY as string | undefined

export const fetchTestQuery = async (): Promise<string> => {
  if (!TEST_QUERY) {
    throw new Error('TEST_QUERY is not configured')
  }
  const response = await fetch(TEST_QUERY, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`TEST_QUERY request failed (${response.status})`)
  }
  const data: unknown = await response.json()
  if (typeof data === 'string') {
    return data
  }
  return String(data)
}
