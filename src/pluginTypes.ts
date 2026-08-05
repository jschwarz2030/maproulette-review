import type { ComponentType, ReactNode } from 'react'
import type { PluginApiContext, PluginUser, RouteParams } from './types'

export type PluginPage = {
  id: string
  title: string
  path: string
  description?: string
  component: ComponentType<{ params?: RouteParams }>
}

export type PluginNavigationItem = {
  id: string
  label: string
  to: string
  order?: number
}

export type ChallengeActionContext = {
  challenge: unknown
  user?: PluginUser | null
}

export type Plugin = {
  metadata: {
    id: string
    name: string
    description: string
    version: string
    author?: string
  }
  initialize?: (context?: PluginApiContext) => void
  getNavigationItems?: () => PluginNavigationItem[]
  getPages?: () => PluginPage[]
  getTaskActionExtensions?: () => Array<{
    id: string
    label?: string
    order?: number
    component?: ComponentType<{
      task: unknown
      newStatus: number
      setNewStatus: (status: number) => void
      formState: Record<string, unknown>
      setFormState: (patch: Record<string, unknown>) => void
    }>
    getStatusQueryParams?: (
      formState: Record<string, unknown>,
      context: { newStatus: number; task: unknown }
    ) => Record<string, string | boolean | number | undefined | null>
  }>
  getTaskActionPanels?: () => Array<{
    id: string
    label?: string
    slot?: 'replace' | 'append'
    order?: number
    isActive?: (context: {
      pathname: string
      search: Record<string, unknown>
      task: unknown
    }) => boolean
    component: ComponentType<{
      task: unknown
      search: Record<string, unknown>
      pathname: string
    }>
  }>
  getTaskEditPolicies?: () => Array<{
    id: string
    order?: number
    isEditable: (task: unknown, context: { userId: number | null }) => boolean
  }>
  getChallengeFooterExtensions?: () => Array<{
    id: string
    order?: number
    component: ComponentType<ChallengeActionContext & { mapContent: ReactNode }>
  }>
  getTaskHistoryItemRenderers?: () => Array<{
    id: string
    order?: number
    canRender: (item: {
      taskId: number
      timestamp: string
      actionType: number
      [key: string]: unknown
    }) => boolean
    component: ComponentType<{
      item: {
        taskId: number
        timestamp: string
        actionType: number
        [key: string]: unknown
      }
      index: number
    }>
  }>
  getUserSettingsFields?: () => Array<{
    id: string
    name: string
    order?: number
    component: ComponentType<{
      value: unknown
      onChange: (value: unknown) => void
      disabled?: boolean
    }>
  }>
}
