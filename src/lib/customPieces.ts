/**
 * Custom pieces.
 *
 * Nearly everything in a van starts as something recognisable and then gets
 * changed — a galley made 80mm shallower to clear the door, a tank cut down to
 * fit between the arches. The catalog is a starting point, and the moment you
 * change one it stops describing a catalog item and starts describing yours.
 *
 * So "custom" is derived by comparing an object against the entry it came from,
 * not stored as a flag. Resize something back to standard and it is standard
 * again, which is the behaviour anyone would expect and the one a stored flag
 * would get wrong.
 */

import { catalogItem } from './catalog'
import type { CatalogItem, Grams, Size3, VanObject } from './definitions'

/** Millimetres cubed per litre. */
const MM3_PER_LITRE = 1_000_000

/** Water weighs a kilogram a litre. */
const GRAMS_PER_LITRE = 1000

export interface PieceOrigin {
  /** The catalog entry it came from, if that entry still exists. */
  original: CatalogItem | null
  /** True once it differs from that entry. */
  isCustom: boolean
  /** What changed, for the badge tooltip. */
  changes: string[]
}

function sizeDiffers(a: Size3, b: Size3): boolean {
  return a.w !== b.w || a.d !== b.d || a.h !== b.h
}

/**
 * Work out whether an object still matches the catalog entry it came from.
 *
 * An object with no `catalogSlug` was built from scratch and is custom by
 * definition. One whose entry has since been removed from the catalog is custom
 * too — there is nothing left to say it matches.
 */
export function pieceOrigin(object: VanObject): PieceOrigin {
  if (!object.catalogSlug) {
    return { original: null, isCustom: true, changes: [] }
  }

  const original = catalogItem(object.catalogSlug) ?? null
  if (!original) {
    return { original: null, isCustom: true, changes: [] }
  }

  const changes: string[] = []
  if (sizeDiffers(object.size, original.size)) changes.push('dimensions')
  if (object.mass !== original.mass) changes.push('mass')
  if (object.name !== original.name) changes.push('name')

  // A rename alone is not enough to call something a different piece — people
  // label two identical lockers "left" and "right" all the time.
  const structural = changes.filter((change) => change !== 'name')

  return { original, isCustom: structural.length > 0, changes }
}

/**
 * Whether the user may resize this object directly.
 *
 * Built from scratch, or from an entry that no longer exists: it is theirs to
 * size. A manufactured item is locked until it has been made custom — after
 * which it already describes their own piece rather than the product, so
 * locking it again would be pointless.
 */
export function isResizable(object: VanObject): boolean {
  const { original, isCustom } = pieceOrigin(object)
  if (!original) return true
  if (original.resizable !== false) return true
  return isCustom
}

/**
 * Mass after a resize.
 *
 * Only water containers follow their volume. Everything else keeps whatever
 * mass it has: a galley made 100mm wider does gain a little plywood, but
 * guessing at that would be inventing precision the catalog does not have.
 */
export function massAfterResize(
  object: VanObject,
  nextSize: Size3,
): Grams {
  const { original } = pieceOrigin(object)
  if (!original || original.massModel !== 'water') return object.mass

  const originalLitres = volumeLitres(original.size)
  const nextLitres = volumeLitres(nextSize)
  if (originalLitres <= 0) return object.mass

  // Split the catalog mass into water and shell, then rescale the water. The
  // shell is assumed to stay roughly as it was, which is closer to the truth
  // than scaling the whole figure.
  const originalWater = originalLitres * GRAMS_PER_LITRE
  const shell = Math.max(0, original.mass - originalWater)

  return Math.round(nextLitres * GRAMS_PER_LITRE + shell)
}

export function volumeLitres(size: Size3): number {
  return (size.w * size.d * size.h) / MM3_PER_LITRE
}

/** Label for the badge shown against a modified piece. */
export function describeOrigin(object: VanObject): string | null {
  const { original, isCustom, changes } = pieceOrigin(object)
  if (!isCustom) return null
  if (!original) return 'Custom piece'

  const what = changes.length > 0 ? changes.join(' and ') : 'dimensions'
  return `Custom — ${what} changed from ${original.name}`
}
