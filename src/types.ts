import type { ComponentType, ReactNode } from 'react'

export type RouteParams = Record<string, string>

export type PluginTaskMapItem = {
  id: number
  parent: number
  bundleId?: number | null
  location: {
    coordinates: [number, number]
  }
}

export type HostUiComponents = {
  Button: ComponentType<Record<string, unknown>>
  Badge: ComponentType<Record<string, unknown>>
  Alert: ComponentType<Record<string, unknown>>
  AlertTitle: ComponentType<Record<string, unknown>>
  AlertDescription: ComponentType<Record<string, unknown>>
  Separator: ComponentType<Record<string, unknown>>
  StatCard: ComponentType<Record<string, unknown>>
  StatCardGrid: ComponentType<Record<string, unknown>>
  ProgressBar: ComponentType<Record<string, unknown>>
  Label: ComponentType<Record<string, unknown>>
  Textarea: ComponentType<Record<string, unknown>>
  Tabs: ComponentType<Record<string, unknown>>
  TabsList: ComponentType<Record<string, unknown>>
  TabsTrigger: ComponentType<Record<string, unknown>>
  TabsContent: ComponentType<Record<string, unknown>>
  Dialog: ComponentType<Record<string, unknown>>
  DialogContent: ComponentType<Record<string, unknown>>
  DialogHeader: ComponentType<Record<string, unknown>>
  DialogFooter: ComponentType<Record<string, unknown>>
  DialogTitle: ComponentType<Record<string, unknown>>
  DialogDescription: ComponentType<Record<string, unknown>>
  RadioGroup: ComponentType<Record<string, unknown>>
  RadioGroupItem: ComponentType<Record<string, unknown>>
  Select: ComponentType<{
    children?: ReactNode
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
  }>
  SelectValue: ComponentType<{ placeholder?: string; className?: string }>
  SelectTrigger: ComponentType<{
    children?: ReactNode
    className?: string
    size?: 'sm' | 'default'
    'aria-label'?: string
    onClick?: (event: { stopPropagation: () => void }) => void
  }>
  SelectContent: ComponentType<{ children?: ReactNode; className?: string }>
  SelectItem: ComponentType<{
    children?: ReactNode
    className?: string
    value: string
    disabled?: boolean
  }>
  TaskSelectionMap: ComponentType<{
    currentTask: PluginTaskMapItem
    tasks: PluginTaskMapItem[]
    selectedTaskId: number | null
    onTaskSelect: (taskId: number | null) => void
    showSelectedBadge?: boolean
  }>
  CommentsHistoryTab: ComponentType<{ taskId?: number; readOnly?: boolean }>
  Table: ComponentType<Record<string, unknown>>
  TableHeader: ComponentType<Record<string, unknown>>
  TableBody: ComponentType<Record<string, unknown>>
  TableRow: ComponentType<Record<string, unknown>>
  TableHead: ComponentType<Record<string, unknown>>
  TableCell: ComponentType<Record<string, unknown>>
  Card: ComponentType<Record<string, unknown>>
  CardHeader: ComponentType<Record<string, unknown>>
  CardTitle: ComponentType<Record<string, unknown>>
  CardDescription: ComponentType<Record<string, unknown>>
  CardContent: ComponentType<Record<string, unknown>>
  CardFooter: ComponentType<Record<string, unknown>>
  Empty: ComponentType<Record<string, unknown>>
  EmptyHeader: ComponentType<Record<string, unknown>>
  EmptyTitle: ComponentType<Record<string, unknown>>
  EmptyDescription: ComponentType<Record<string, unknown>>
  EmptyContent: ComponentType<Record<string, unknown>>
  Skeleton: ComponentType<Record<string, unknown>>
  Collapsible: ComponentType<{
    children?: ReactNode
    className?: string
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
  }>
  CollapsibleTrigger: ComponentType<Record<string, unknown>>
  CollapsibleContent: ComponentType<Record<string, unknown>>
  SidePanel: ComponentType<{
    open: boolean
    onClose: () => void
    children?: ReactNode
    className?: string
    widthClassName?: string
    'aria-label'?: string
  }>
  SidePanelHeader: ComponentType<Record<string, unknown>>
  SidePanelTitle: ComponentType<Record<string, unknown>>
  SidePanelBody: ComponentType<Record<string, unknown>>
  SidePanelFooter: ComponentType<Record<string, unknown>>
}

export type PluginUser = {
  id: number
  /** Opaque host settings; review plugin reads isReviewer from here. */
  settings?: Record<string, unknown>
}

export type PluginApiContext = {
  theme?: {
    isDarkMode: () => boolean
    getThemeTokens: () => Record<string, string>
  }
  apiRequest?: {
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
    post: (
      url: string,
      options?: {
        json?: unknown
      }
    ) => {
      json: <T = unknown>() => Promise<T>
      text: () => Promise<string>
    }
  }
  navigate?: (path: string) => void
  user?: PluginUser | null
  ui?: HostUiComponents
}

export type TaskReviewFields = {
  reviewStatus?: number | null
  reviewClaimedBy?: number | null
  reviewClaimedByUsername?: string | null
  reviewRequestedBy?: number | null
  reviewedBy?: number | null
  reviewedByUsername?: string | null
  reviewRequestedByUsername?: string | null
}

export type ReviewTask = {
  id: number
  name?: string
  instruction?: string
  status?: number
  priority?: number
  review?: TaskReviewFields
  completedBy?: number | null
  mappedOn?: string
  reviewedAt?: string
  errorTags?: string | null
  location?: {
    coordinates: [number, number]
  }
  geometries?: unknown
  bundleId?: number | null
  parent?:
    | number
    | {
        id?: number
        name?: string
        requireRejectReason?: boolean | null
      }
}

export type TaskComment = {
  id: number
  osm_id: number
  osm_username: string
  avatarUrl?: string
  taskId: number
  challengeId?: number
  projectId?: number
  created: number
  comment: string
  actionId?: number | null
  edited?: boolean
  taskStatus?: number | null
  reviewStatus?: number | null
}

export type MapperViewMode = 'needsAction' | 'activity'
/** Sub-filters only apply in activity mode. */
/** Shared status filter for mapper activity and reviewer dashboard tables. */
export type ReviewStatusFilter = 'all' | 'needsRevision' | 'awaitingReview' | 'resolved'
export type MapperActivityFilter = ReviewStatusFilter
/** @deprecated Prefer MapperViewMode + ReviewStatusFilter */
export type MapperFilter = ReviewStatusFilter
export type ReviewerTab = 'toReview' | 'myReviews'
