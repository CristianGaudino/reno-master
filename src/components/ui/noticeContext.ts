import { createContext } from 'react'

export interface Notice {
  id: number
  message: string
  detail?: string
}

export interface NoticeContextValue {
  notify(message: string, detail?: string): void
}

/**
 * Kept apart from the provider component.
 *
 * A module that exports both a component and a context loses fast refresh —
 * editing the provider would remount the whole tree rather than hot-swapping it.
 */
export const NoticeContext = createContext<NoticeContextValue | null>(null)
