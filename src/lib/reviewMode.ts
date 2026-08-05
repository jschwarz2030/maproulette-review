/** Task completion statuses that should automatically enter the review queue. */
export const COMPLETION_STATUSES = [1, 2, 5, 6]

/** True when the host task page is in review mode (`?review=true|1`). */
export const isReviewModeActive = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  const review = new URLSearchParams(window.location.search).get('review')
  return review === 'true' || review === '1'
}
