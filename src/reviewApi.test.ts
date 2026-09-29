import { beforeEach, describe, expect, it, vi } from 'vitest'

const json = vi.fn()
const get = vi.fn(() => ({ json }))

vi.mock('./host', () => ({
  getHostApiRequest: () => ({ get }),
}))

describe('review session lock APIs', () => {
  beforeEach(() => {
    json.mockReset()
    get.mockClear()
    json.mockResolvedValue({ id: 1 })
  })

  it('starts a review claim without session query params', async () => {
    const { startTaskReview } = await import('./reviewApi')
    await startTaskReview(9)
    expect(get).toHaveBeenCalledWith('api/v2/task/9/review/start')
  })

  it('claims the next challenge review without session query params', async () => {
    const { fetchNextChallengeReview } = await import('./reviewApi')
    await fetchNextChallengeReview(12)
    expect(get).toHaveBeenCalledWith('api/v2/tasks/review/next?cid=12')
  })

  it('cancels a review claim without session params', async () => {
    const { cancelTaskReview } = await import('./reviewApi')
    await cancelTaskReview(9)
    expect(get).toHaveBeenCalledWith('api/v2/task/9/review/cancel')
  })
})
