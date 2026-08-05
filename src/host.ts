import type { HostUiComponents, PluginApiContext, PluginUser } from './types'

let hostUiFromInit: HostUiComponents | undefined
let hostApiRequest: PluginApiContext['apiRequest']
let hostNavigate: ((path: string) => void) | undefined
let hostUser: PluginUser | null | undefined
/** Plugin-owned cache of volunteer-as-reviewer status (not read from core). */
let cachedIsReviewer = false

export const setHostContext = (context?: PluginApiContext): void => {
  hostUiFromInit = context?.ui
  hostApiRequest = context?.apiRequest
  hostNavigate = context?.navigate
  if (context?.user && typeof context.user.id === 'number') {
    rememberReviewerStatus(context.user)
  } else {
    hostUser = null
  }
}

const readIsReviewerSetting = (settings?: Record<string, unknown>): boolean | null => {
  if (!settings || !('isReviewer' in settings)) return null
  const value = settings.isReviewer
  if (value == null) return null
  return Boolean(value)
}

export const rememberReviewerStatus = (user?: PluginUser | null): void => {
  if (!user) return
  const fromSettings = readIsReviewerSetting(user.settings)
  if (fromSettings != null) {
    cachedIsReviewer = fromSettings
  }
  hostUser = {
    id: user.id,
    settings: user.settings,
  }
}

export const loadReviewerStatus = async (): Promise<boolean> => {
  if (!hostApiRequest) {
    return cachedIsReviewer
  }
  try {
    const whoAmI = await hostApiRequest.get('api/v2/user/whoami').json<{
      id?: number
      settings?: Record<string, unknown>
    }>()
    if (typeof whoAmI?.id === 'number') {
      rememberReviewerStatus({
        id: whoAmI.id,
        settings: whoAmI.settings,
      })
    }
  } catch {
    // Keep the last known value if whoami fails.
  }
  return cachedIsReviewer
}

export const isCurrentUserReviewer = (user?: PluginUser | null): boolean => {
  const fromSettings = readIsReviewerSetting(user?.settings)
  if (fromSettings != null) {
    return fromSettings
  }
  return cachedIsReviewer
}

export const getHostUser = (): PluginUser | null => {
  const live = (
    window as unknown as {
      __maproulettePluginApi?: {
        user?: PluginUser | null
      }
    }
  ).__maproulettePluginApi

  return live?.user ?? hostUser ?? null
}

export const getHostUi = (): HostUiComponents => {
  const liveContext = (
    window as unknown as {
      __maproulettePluginApi?: {
        ui?: HostUiComponents
      }
    }
  ).__maproulettePluginApi

  if (liveContext?.ui?.Button) {
    return liveContext.ui
  }
  if (hostUiFromInit?.Button) {
    return hostUiFromInit
  }

  throw new Error('Host UI kit is unavailable')
}

export const navigateInHostApp = (path: string): void => {
  if (typeof window === 'undefined') return
  if (hostNavigate) {
    hostNavigate(path)
    return
  }
  window.location.assign(path)
}

export const handleHostNavigationClick = (
  event: {
    preventDefault: () => void
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    button?: number
  },
  path: string
): void => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return
  }

  event.preventDefault()
  navigateInHostApp(path)
}

export const getHostApiRequest = (): NonNullable<PluginApiContext['apiRequest']> => {
  const live = (
    window as unknown as {
      __maproulettePluginApi?: {
        apiRequest?: PluginApiContext['apiRequest']
      }
    }
  ).__maproulettePluginApi

  const apiRequest = live?.apiRequest ?? hostApiRequest
  if (!apiRequest) {
    throw new Error('Host apiRequest is unavailable')
  }
  return apiRequest
}
