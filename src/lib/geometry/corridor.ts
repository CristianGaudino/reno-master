/**
 * Circulation measurement for the aisle-width rule.
 *
 * The van is scanned in slices along its length; at each slice the free spans
 * between obstructions are measured across the width, and the widest one is
 * taken as the walkway at that point. The narrowest walkway over the whole
 * length is what the rule reports.
 *
 * This measures a straight corridor. It does not model an L-shaped route around
 * a corner, so a layout with a dog-leg walkway can measure narrower than it
 * really walks. That limitation is deliberate for v1 and is stated in the README
 * rather than hidden — a proper walkable-region analysis (rasterise, flood-fill
 * from the door, distance transform) is a larger job and belongs with the layers
 * work.
 */

import { CIRCULATION_Z_BAND, CORRIDOR_SCAN_STEP_MM } from '../constants'
import type { Mm, Size3, TaperPoint } from '../definitions'
import { narrowestXRangeBetween } from './frame'
import { boxExtent, type Box3 } from './obb'

export interface CorridorSlice {
  /** Position along the van. */
  y: Mm
  /** Widest free span across the van at this point. */
  width: Mm
  /** Where that span sits, so the UI can draw it. */
  from: Mm
  to: Mm
}

export interface CorridorResult {
  /** Narrowest point of the walkway over the scanned length. */
  minWidth: Mm
  /** Where that narrowest point is. */
  atY: Mm
  narrowestSlice: CorridorSlice | null
  slices: CorridorSlice[]
  /** Objects bounding the narrowest slice, for highlighting. */
  culpritIds: string[]
}

/** A slice plus the objects that bounded its widest gap. */
type MeasuredSlice = CorridorSlice & { bounding: string[] }

export interface CorridorBlocker {
  id: string
  box: Box3
}

/**
 * Scan the van for its narrowest walkway.
 *
 * Only obstructions intersecting the height band a walking body occupies are
 * counted: a floor-level water tank under a raised bed does not narrow the
 * aisle, and neither does an overhead locker above head height.
 */
export function measureCorridor(
  interior: Size3,
  taper: TaperPoint[],
  blockers: CorridorBlocker[],
  step: Mm = CORRIDOR_SCAN_STEP_MM,
): CorridorResult {
  const band = CIRCULATION_Z_BAND

  const relevant = blockers.filter(
    (blocker) => blocker.box.zMax > band.min && blocker.box.zMin < band.max,
  )

  // Interior width available across the walking band, narrowed by wall taper.
  const wallRange = narrowestXRangeBetween(band.min, band.max, interior.w, taper)

  const slices: MeasuredSlice[] = []

  for (let y = 0; y <= interior.d; y += step) {
    const spans: Array<{ min: Mm; max: Mm; id: string }> = []

    for (const blocker of relevant) {
      const extent = boxExtent(blocker.box)
      if (y < extent.minY || y > extent.maxY) continue
      spans.push({ min: extent.minX, max: extent.maxX, id: blocker.id })
    }

    slices.push({ y, ...widestGap(wallRange, spans) })
  }

  /**
   * Where the walkway stops being a walkway.
   *
   * Almost every van has a bed across the back, and a bed spans the full width —
   * so the last stretch of the van is solid. That is the corridor ending, not a
   * corridor of zero width, and reporting "narrowest walkway: 0mm" for the most
   * common layout there is would be both alarming and wrong.
   *
   * A blockage only counts as the end when everything behind it is blocked too.
   * Something solid across the middle with usable space behind it really does
   * cut the van in half, and still gets reported.
   */
  const walkable = trimTrailingBlockage(slices, step)

  let narrowest: CorridorSlice | null = null
  let culpritIds: string[] = []

  for (const slice of walkable) {
    if (narrowest === null || slice.width < narrowest.width) {
      narrowest = slice
      culpritIds = slice.bounding
    }
  }

  return {
    minWidth: narrowest?.width ?? wallRange.max - wallRange.min,
    atY: narrowest?.y ?? 0,
    narrowestSlice: narrowest,
    slices,
    culpritIds,
  }
}

/**
 * Minimum clear depth that counts as somewhere you could actually be.
 *
 * A bed usually stops a little short of the rear doors, leaving a sliver of
 * floor behind it. That sliver is not a room you can get to — it is the gap
 * behind the bed — so it must not make the bed look like a mid-van blockage
 * with usable space beyond.
 */
const USABLE_DEPTH_MM: Mm = 600

/**
 * Cut the scan off where the walkway genuinely ends.
 *
 * Everything from the first full-width blockage onward is dropped, unless there
 * is a meaningful stretch of clear floor beyond it — in which case the blockage
 * really has cut the van in half and deserves to be reported.
 */
function trimTrailingBlockage(slices: MeasuredSlice[], step: Mm): MeasuredSlice[] {
  const firstBlocked = slices.findIndex((slice) => slice.width <= 0)
  if (firstBlocked === -1) return slices

  // Longest continuous clear stretch beyond the blockage.
  let longestClear = 0
  let current = 0
  for (const slice of slices.slice(firstBlocked)) {
    current = slice.width > 0 ? current + step : 0
    longestClear = Math.max(longestClear, current)
  }

  if (longestClear >= USABLE_DEPTH_MM) return slices

  // Nothing usable behind it: this is the end of the corridor, not a blockage.
  // Keep at least one slice so an entirely blocked van still reports zero.
  return firstBlocked === 0 ? slices : slices.slice(0, firstBlocked)
}

/**
 * Widest clear span across one slice.
 *
 * Overlapping obstruction spans are merged first, otherwise two objects side by
 * side would appear to leave a gap between them that does not exist.
 */
function widestGap(
  wall: { min: Mm; max: Mm },
  spans: Array<{ min: Mm; max: Mm; id: string }>,
): { width: Mm; from: Mm; to: Mm; bounding: string[] } {
  if (spans.length === 0) {
    return { width: wall.max - wall.min, from: wall.min, to: wall.max, bounding: [] }
  }

  const clipped = spans
    .map((span) => ({
      min: Math.max(span.min, wall.min),
      max: Math.min(span.max, wall.max),
      id: span.id,
    }))
    .filter((span) => span.max > span.min)
    .sort((a, b) => a.min - b.min)

  if (clipped.length === 0) {
    return { width: wall.max - wall.min, from: wall.min, to: wall.max, bounding: [] }
  }

  const merged: Array<{ min: Mm; max: Mm; ids: string[] }> = []
  for (const span of clipped) {
    const last = merged[merged.length - 1]
    if (last && span.min <= last.max) {
      last.max = Math.max(last.max, span.max)
      last.ids.push(span.id)
    } else {
      merged.push({ min: span.min, max: span.max, ids: [span.id] })
    }
  }

  let best = { width: -Infinity, from: 0, to: 0, bounding: [] as string[] }

  const consider = (
    from: Mm,
    to: Mm,
    bounding: string[],
  ) => {
    const width = to - from
    if (width > best.width) best = { width, from, to, bounding }
  }

  // Gap between the left wall and the first obstruction.
  consider(wall.min, merged[0]!.min, merged[0]!.ids)

  // Gaps between consecutive obstructions.
  for (let i = 0; i < merged.length - 1; i++) {
    consider(merged[i]!.max, merged[i + 1]!.min, [...merged[i]!.ids, ...merged[i + 1]!.ids])
  }

  // Gap between the last obstruction and the right wall.
  const last = merged[merged.length - 1]!
  consider(last.max, wall.max, last.ids)

  return {
    width: Math.max(0, best.width),
    from: best.from,
    to: best.to,
    bounding: best.bounding,
  }
}
