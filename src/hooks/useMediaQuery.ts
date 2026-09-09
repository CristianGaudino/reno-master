import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a media query.
 *
 * Used to render *one* layout rather than rendering both and hiding one with
 * CSS. Two copies of the inspector means two sets of store subscriptions, two
 * renders per edit, and two form fields with the same label sitting in the DOM —
 * which is confusing for anything walking the page, tests included.
 *
 * `useSyncExternalStore` because a MediaQueryList is exactly that: an external
 * source with a subscribe method and a current value.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    // Server snapshot: there is no SSR here, but the hook contract wants one.
    () => false,
  )
}

/** Tailwind's `xl` breakpoint, where the editor gains its side panels. */
export const XL_QUERY = '(min-width: 80rem)'

/** Tailwind's `lg` breakpoint, where the catalog rail appears. */
export const LG_QUERY = '(min-width: 64rem)'
