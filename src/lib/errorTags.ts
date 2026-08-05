import { getHostApiRequest } from '../host'

export type ErrorTagOption = {
  id: number
  name: string
  description?: string | null
  active?: boolean | null
  tagType?: string | null
}

/** Review statuses that accept error codes (matches mr3-main ERROR_TAG_STATUSES). */
export const ERROR_TAG_REVIEW_STATUSES = new Set([2, 3, 7])

const MAX_ERROR_TAGS = 5

let cachedErrorTags: ErrorTagOption[] | null = null
let fetchPromise: Promise<ErrorTagOption[]> | null = null

export const fetchErrorTagOptions = async (): Promise<ErrorTagOption[]> => {
  if (cachedErrorTags) return cachedErrorTags
  if (fetchPromise) return fetchPromise

  const apiRequest = getHostApiRequest()
  if (!apiRequest) {
    return []
  }

  fetchPromise = apiRequest
    .get('api/v2/keywords?tagType=error&limit=1000')
    .json<unknown>()
    .then((response) => {
      const list = Array.isArray(response) ? response : []
      cachedErrorTags = list
        .filter((item): item is ErrorTagOption => {
          return (
            typeof item === 'object' &&
            item !== null &&
            Number.isFinite((item as ErrorTagOption).id) &&
            typeof (item as ErrorTagOption).name === 'string'
          )
        })
        .filter((item) => item.active !== false)
      return cachedErrorTags
    })
    .catch(() => {
      fetchPromise = null
      return [] as ErrorTagOption[]
    })

  return fetchPromise
}

export const parseErrorTagIds = (errorTags?: string | null): number[] => {
  if (!errorTags?.trim()) return []
  return errorTags
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

export const formatErrorTagNames = (
  errorTags: string | null | undefined,
  options: ErrorTagOption[]
): string[] => {
  return parseErrorTagIds(errorTags).map((id) => {
    const match = options.find((option) => option.id === id)
    return match?.name ?? `#${id}`
  })
}

export const canAddMoreErrorTags = (selectedIds: number[], optionsLength: number): boolean =>
  selectedIds.length < MAX_ERROR_TAGS && selectedIds.length < optionsLength

export const serializeErrorTagIds = (ids: number[]): string | undefined => {
  const valid = ids.filter((id) => Number.isFinite(id) && id > 0)
  return valid.length > 0 ? valid.join(',') : undefined
}
