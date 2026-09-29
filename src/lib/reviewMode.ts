/** Task completion statuses that should automatically enter the review queue. */
export const COMPLETION_STATUSES = [1, 2, 5, 6]

const isReviewFlag = (value: unknown): boolean =>
  value === true || value === 'true' || value === '1'

/** True when the host task page is in review mode (`?review=true|1`). */
export const isReviewModeActive = (search?: Record<string, unknown>): boolean => {
  if (search && 'review' in search) {
    return isReviewFlag(search.review)
  }
  if (typeof window === 'undefined') {
    return false
  }
  const review = new URLSearchParams(window.location.search).get('review')
  return isReviewFlag(review)
}
