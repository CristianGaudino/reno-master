/**
 * Class name joiner.
 *
 * No dependency needed: Tailwind classes here are composed, not conditionally
 * conflicting, so plain filtering is enough and avoids pulling in a merge
 * library for a dozen call sites.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
