/**
 * The van coordinate frame, defined once so nothing downstream has to re-derive
 * it. Every position and size in the app is expressed in this frame.
 *
 *   origin  interior floor, front-left corner of the cargo area (behind the
 *           bulkhead, at the finished floor — not the bare metal)
 *   +x      across the van, 0 at the left wall, increasing to the right
 *   +y      along the van, 0 at the bulkhead, increasing toward the rear doors
 *   +z      up from the finished floor
 *
 * Looking down at the floor plan with the front of the van at the top, +x is
 * right on screen and +y is down. Yaw is measured clockwise in that same view,
 * which keeps screen rotation and model rotation the same sign.
 *
 * "Left" and "right" are as seen by someone standing inside facing forward, so
 * they do not flip between left- and right-hand-drive markets.
 */

import type { Mm, Size3, TaperPoint, Vec3, ViewMode } from '../definitions'

/**
 * Which model axes map to the screen for each view, and which axis is being
 * looked along ("through"). This single table is what lets one editor component
 * serve all three views: drag handling, hit-testing and rendering all consult it
 * rather than branching per view.
 */
export const VIEW_AXES: Record<
  ViewMode,
  { u: keyof Vec3; v: keyof Vec3; through: keyof Vec3; uSize: keyof Size3; vSize: keyof Size3; throughSize: keyof Size3 }
> = {
  // Looking down. Screen right = +x, screen down = +y (front of van at top).
  top: { u: 'x', v: 'y', through: 'z', uSize: 'w', vSize: 'd', throughSize: 'h' },
  // Looking at the left wall from outside. Screen right = +y (front at left),
  // screen up = +z.
  side: { u: 'y', v: 'z', through: 'x', uSize: 'd', vSize: 'h', throughSize: 'w' },
  // Looking forward from behind the van. Screen right = +x, screen up = +z.
  rear: { u: 'x', v: 'z', through: 'y', uSize: 'w', vSize: 'h', throughSize: 'd' },
}

/** Views whose vertical screen axis is +z, and so must be flipped when drawn. */
export function isElevation(view: ViewMode): boolean {
  return view === 'side' || view === 'rear'
}

export const VIEW_LABELS: Record<ViewMode, string> = {
  top: 'Top-down',
  side: 'Side elevation',
  rear: 'Rear elevation',
}

/**
 * Interior half-width available at a given height, accounting for wall taper.
 *
 * The taper profile is a list of (z, inset) samples; between samples the wall is
 * interpolated linearly, which is close enough for the gentle curve of a panel
 * van side and far better than pretending the wall is vertical.
 *
 * Returns the usable x range at that height.
 */
export function interiorXRangeAt(
  z: Mm,
  interiorWidth: Mm,
  taper: TaperPoint[],
): { min: Mm; max: Mm } {
  if (taper.length === 0) return { min: 0, max: interiorWidth }

  const sorted = [...taper].sort((a, b) => a.z - b.z)
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!

  if (z <= first.z) return { min: first.insetLeft, max: interiorWidth - first.insetRight }
  if (z >= last.z) return { min: last.insetLeft, max: interiorWidth - last.insetRight }

  for (let i = 0; i < sorted.length - 1; i++) {
    const lower = sorted[i]!
    const upper = sorted[i + 1]!
    if (z >= lower.z && z <= upper.z) {
      const span = upper.z - lower.z
      const t = span === 0 ? 0 : (z - lower.z) / span
      const insetLeft = lower.insetLeft + (upper.insetLeft - lower.insetLeft) * t
      const insetRight = lower.insetRight + (upper.insetRight - lower.insetRight) * t
      return { min: insetLeft, max: interiorWidth - insetRight }
    }
  }

  return { min: 0, max: interiorWidth }
}

/**
 * Narrowest interior x range across a height band.
 *
 * An object spanning floor to shoulder must fit the tightest slice it passes
 * through, not the widest — checking only its base is exactly how a tall cabinet
 * ends up fouling the wall in reality.
 */
export function narrowestXRangeBetween(
  zMin: Mm,
  zMax: Mm,
  interiorWidth: Mm,
  taper: TaperPoint[],
): { min: Mm; max: Mm } {
  if (taper.length === 0) return { min: 0, max: interiorWidth }

  // The extremes of a piecewise-linear profile can only occur at the band ends
  // or at a sample point inside the band, so those are the only places to look.
  const candidates: Mm[] = [zMin, zMax]
  for (const point of taper) {
    if (point.z > zMin && point.z < zMax) candidates.push(point.z)
  }

  let min = -Infinity
  let max = Infinity
  for (const z of candidates) {
    const range = interiorXRangeAt(z, interiorWidth, taper)
    if (range.min > min) min = range.min
    if (range.max < max) max = range.max
  }

  return { min, max }
}
