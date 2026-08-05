import { ReviewHistoryItem, canRenderReviewHistoryItem } from './components/ReviewHistoryItem'
import {
  isMapperRevisionPanelActive,
  MapperRevisionActionsPanel,
} from './components/MapperRevisionActions'
import { ReviewChallengeFooter } from './components/ReviewChallengeWidget'
import { ReviewTaskActionsPanel } from './components/ReviewTaskActions'
import { ReviewerSettingsField } from './components/ReviewerSettingsField'
import { COMPLETION_STATUSES, isReviewModeActive } from './lib/reviewMode'
import { isRejectedForMapperRevision } from './lib/reviewStatus'
import { ReviewedRedirectPage, ReviewDashboard } from './pages/ReviewDashboard'
import type { Plugin } from './pluginTypes'

export const getNavigationItems: NonNullable<Plugin['getNavigationItems']> = () => [
  {
    id: 'maproulette-review-nav',
    label: 'Review',
    to: '/review',
    order: 90,
  },
]

export const getPages: NonNullable<Plugin['getPages']> = () => [
  {
    id: 'maproulette-review-dashboard-page',
    title: 'Review',
    path: '/review',
    component: ReviewDashboard,
    description: 'Review dashboard for mappers and reviewers',
  },
  {
    id: 'maproulette-review-reviewed-page',
    title: 'Reviewed',
    path: '/reviewed',
    component: ReviewedRedirectPage,
    description: 'Alias for the review dashboard',
  },
]

export const getTaskActionExtensions: NonNullable<Plugin['getTaskActionExtensions']> = () => [
  {
    id: 'maproulette-review-request-review',
    label: 'Request Review',
    order: 10,
    getStatusQueryParams: (_formState, { newStatus, task }) => {
      const forceReview =
        isRejectedForMapperRevision(task) || COMPLETION_STATUSES.includes(newStatus)
      return {
        requestReview: forceReview ? true : undefined,
      }
    },
  },
]

export const getTaskEditPolicies: NonNullable<Plugin['getTaskEditPolicies']> = () => [
  {
    id: 'maproulette-review-mapper-revision',
    order: 10,
    isEditable: (task) => isRejectedForMapperRevision(task),
  },
]

export const getTaskActionPanels: NonNullable<Plugin['getTaskActionPanels']> = () => [
  {
    id: 'maproulette-review-task-panel',
    label: 'Review Task Actions',
    slot: 'replace',
    order: 10,
    isActive: () => isReviewModeActive(),
    component: ReviewTaskActionsPanel,
  },
  {
    id: 'maproulette-review-mapper-revision-panel',
    label: 'Mapper Revision Actions',
    slot: 'append',
    order: 20,
    isActive: isMapperRevisionPanelActive,
    component: MapperRevisionActionsPanel,
  },
]

export const getChallengeFooterExtensions: NonNullable<
  Plugin['getChallengeFooterExtensions']
> = () => [
  {
    id: 'maproulette-review-challenge-footer',
    order: 10,
    component: ReviewChallengeFooter,
  },
]

export const getTaskHistoryItemRenderers: NonNullable<
  Plugin['getTaskHistoryItemRenderers']
> = () => [
  {
    id: 'maproulette-review-history-item',
    order: 10,
    canRender: canRenderReviewHistoryItem,
    component: ReviewHistoryItem,
  },
]

export const getUserSettingsFields: NonNullable<Plugin['getUserSettingsFields']> = () => [
  {
    id: 'maproulette-review-volunteer-reviewer',
    name: 'isReviewer',
    order: 20,
    component: ReviewerSettingsField,
  },
]
