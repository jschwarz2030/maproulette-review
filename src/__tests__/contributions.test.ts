import { describe, expect, it, afterEach } from 'vitest'
import {
  getChallengeFooterExtensions,
  getNavigationItems,
  getPages,
  getTaskActionExtensions,
  getTaskActionPanels,
  getTaskEditPolicies,
  getTaskHistoryItemRenderers,
  getUserSettingsFields,
} from '../contributions'
import { COMPLETION_STATUSES, isReviewModeActive } from '../lib/reviewMode'
import { isRejectedForMapperRevision } from '../lib/reviewStatus'
import { canRenderReviewHistoryItem } from '../components/ReviewHistoryItem'
import { isMapperRevisionPanelActive } from '../components/MapperRevisionActions'
import {
  ERROR_TAG_REVIEW_STATUSES,
  parseErrorTagIds,
  serializeErrorTagIds,
} from '../lib/errorTags'
import plugin from '../plugin'

const rejectedTask = { id: 1, review: { reviewStatus: 2 } }
const approvedTask = { id: 2, review: { reviewStatus: 1 } }
const requestedTask = { id: 3, review: { reviewStatus: 0 } }

describe('reviewMode', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/tasks/1')
  })

  it('exports completion statuses that request review', () => {
    expect(COMPLETION_STATUSES).toEqual([1, 2, 5, 6])
  })

  it('detects review mode from query params', () => {
    window.history.replaceState({}, '', '/tasks/1')
    expect(isReviewModeActive()).toBe(false)

    window.history.replaceState({}, '', '/tasks/1?review=true')
    expect(isReviewModeActive()).toBe(true)

    window.history.replaceState({}, '', '/tasks/1?review=1')
    expect(isReviewModeActive()).toBe(true)

    window.history.replaceState({}, '', '/tasks/1?review=false')
    expect(isReviewModeActive()).toBe(false)
  })
})

describe('mapper revision helpers', () => {
  it('only unlocks rejected tasks for mapper revision', () => {
    expect(isRejectedForMapperRevision(rejectedTask)).toBe(true)
    expect(isRejectedForMapperRevision(approvedTask)).toBe(false)
    expect(isRejectedForMapperRevision(requestedTask)).toBe(false)
    expect(isRejectedForMapperRevision({ id: 4 })).toBe(false)
  })

  it('activates mapper revision panel only for rejected tasks', () => {
    expect(
      isMapperRevisionPanelActive({
        search: {},
        task: rejectedTask,
      })
    ).toBe(true)
    expect(
      isMapperRevisionPanelActive({
        search: {},
        task: approvedTask,
      })
    ).toBe(false)
    expect(
      isMapperRevisionPanelActive({
        search: { review: 'true' },
        task: rejectedTask,
      })
    ).toBe(false)
  })
})

describe('error tags', () => {
  it('parses and serializes CSV error tag ids', () => {
    expect(parseErrorTagIds('1,2,3')).toEqual([1, 2, 3])
    expect(parseErrorTagIds(null)).toEqual([])
    expect(serializeErrorTagIds([3, 1, 2])).toBe('3,1,2')
  })

  it('requires error tags for reject / approve-with-fixes statuses', () => {
    expect(ERROR_TAG_REVIEW_STATUSES.has(2)).toBe(true)
    expect(ERROR_TAG_REVIEW_STATUSES.has(3)).toBe(true)
    expect(ERROR_TAG_REVIEW_STATUSES.has(1)).toBe(false)
  })
})

describe('history item rendering', () => {
  it('renders review and meta-review actions only', () => {
    expect(
      canRenderReviewHistoryItem({
        taskId: 1,
        timestamp: '2024-01-01',
        actionType: 2,
      })
    ).toBe(true)
    expect(
      canRenderReviewHistoryItem({
        taskId: 1,
        timestamp: '2024-01-01',
        actionType: 4,
      })
    ).toBe(true)
    expect(
      canRenderReviewHistoryItem({
        taskId: 1,
        timestamp: '2024-01-01',
        actionType: 0,
      })
    ).toBe(false)
  })
})

describe('plugin contributions', () => {
  it('registers navigation and pages', () => {
    expect(getNavigationItems()).toEqual([
      expect.objectContaining({ id: 'maproulette-review-nav', to: '/review' }),
    ])
    const pages = getPages()
    expect(pages.map((p) => p.path)).toEqual(['/review', '/reviewed'])
    expect(pages.every((p) => typeof p.component === 'function')).toBe(true)
  })

  it('requests review on completion statuses and rejected mapper revision', () => {
    const [extension] = getTaskActionExtensions()
    expect(extension.id).toBe('maproulette-review-request-review')

    expect(
      extension.getStatusQueryParams?.({}, { newStatus: 1, task: approvedTask })
    ).toEqual({ requestReview: true })
    expect(
      extension.getStatusQueryParams?.({}, { newStatus: 0, task: rejectedTask })
    ).toEqual({ requestReview: true })
    expect(
      extension.getStatusQueryParams?.({}, { newStatus: 0, task: approvedTask })
    ).toEqual({ requestReview: undefined })
  })

  it('unlocks editing for rejected tasks via edit policy', () => {
    const [policy] = getTaskEditPolicies()
    expect(policy.isEditable(rejectedTask, { userId: 1 })).toBe(true)
    expect(policy.isEditable(approvedTask, { userId: 1 })).toBe(false)
  })

  it('activates review replace panel only in review mode', () => {
    const panels = getTaskActionPanels()
    const reviewPanel = panels.find((p) => p.id === 'maproulette-review-task-panel')
    const mapperPanel = panels.find(
      (p) => p.id === 'maproulette-review-mapper-revision-panel'
    )

    expect(reviewPanel?.slot).toBe('replace')
    expect(mapperPanel?.slot).toBe('append')

    window.history.replaceState({}, '', '/tasks/1')
    expect(
      reviewPanel?.isActive?.({ pathname: '/tasks/1', search: {}, task: {} })
    ).toBe(false)

    window.history.replaceState({}, '', '/tasks/1?review=true')
    expect(
      reviewPanel?.isActive?.({ pathname: '/tasks/1', search: {}, task: {} })
    ).toBe(true)

    expect(
      mapperPanel?.isActive?.({
        pathname: '/tasks/1',
        search: {},
        task: rejectedTask,
      })
    ).toBe(true)
  })

  it('registers challenge footer, history renderer, and settings field', () => {
    expect(getChallengeFooterExtensions()[0]?.id).toBe(
      'maproulette-review-challenge-footer'
    )
    expect(getTaskHistoryItemRenderers()[0]?.id).toBe(
      'maproulette-review-history-item'
    )
    expect(getUserSettingsFields()[0]).toEqual(
      expect.objectContaining({
        id: 'maproulette-review-volunteer-reviewer',
        name: 'isReviewer',
      })
    )
  })

  it('exposes the same contribution surface on the default plugin export', () => {
    expect(plugin.metadata.id).toBe('maproulette-review-plugin')
    expect(plugin.getPages?.().map((p) => p.path)).toEqual(['/review', '/reviewed'])
    expect(plugin.getTaskActionPanels?.()).toHaveLength(2)
    expect(plugin.getTaskEditPolicies?.()).toHaveLength(1)
    expect(
      (window as unknown as { maprouletteReviewPlugin: unknown }).maprouletteReviewPlugin
    ).toBe(plugin)
  })
})
