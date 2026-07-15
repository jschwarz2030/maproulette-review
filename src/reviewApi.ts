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

