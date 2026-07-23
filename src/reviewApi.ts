type ApiRequest = {
  put: (
    url: string,
    options?: {
      json?: unknown
    }
  ) => {
    json: <T = unknown>() => Promise<T>
    text: () => Promise<string>
  }
  get: (url: string) => {
    json: <T = unknown>() => Promise<T>
    text: () => Promise<string>
  }
}

const getApiRequest = (): ApiRequest => {
  const live = (
    window as unknown as {
      __maproulettePluginApi?: {
        apiRequest?: ApiRequest
      }
    }
  ).__maproulettePluginApi

  if (!live?.apiRequest) {
    throw new Error('Host apiRequest is unavailable')
  }

  return live.apiRequest
}

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
}: {
  taskId: number
  reviewStatus: number
  comment?: string
}): Promise<T> => {
  const apiRequest = getApiRequest()
  const trimmed = comment?.trim()
  await apiRequest.put(`api/v2/task/${taskId}/review/${reviewStatus}`, {
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

