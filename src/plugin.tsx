import {
  getChallengeFooterExtensions,
  getNavigationItems,
  getPages,
  getTaskActionExtensions,
  getTaskActionPanels,
  getTaskEditPolicies,
  getTaskHistoryItemRenderers,
  getUserSettingsFields,
} from './contributions'
import { loadReviewerStatus, setHostContext } from './host'
import type { Plugin } from './pluginTypes'

const plugin: Plugin = {
  metadata: {
    id: 'maproulette-review-plugin',
    name: 'MapRoulette Review',
    description: 'Demo remote plugin served from a separate application',
    version: '0.1.0',
    author: 'MapRoulette Team',
  },
  initialize: (context) => {
    setHostContext(context)
    void loadReviewerStatus()
  },
  getNavigationItems,
  getPages,
  getTaskActionExtensions,
  getTaskEditPolicies,
  getTaskActionPanels,
  getChallengeFooterExtensions,
  getTaskHistoryItemRenderers,
  getUserSettingsFields,
}

;(window as unknown as Record<string, unknown>).maprouletteReviewPlugin = plugin

export default plugin
