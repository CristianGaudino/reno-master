/**
 * Snapping while dragging.
 *
 * Two layers: a coarse grid, and edge alignment to walls, obstacles and other
 * objects. Edge snapping is what actually matters in a van — almost everything
 * is built flush against a wall or against the unit next to it, and a cabinet
 * that lands 3mm off looks fine on screen and does not fit in reality.
 *
 * Edge snaps take priority over the grid: if you are within tolerance of a real
 * edge, that is where you meant to be.
 */

import { SNAP_TOLERANCE_MM } from './config'
import type { Mm, Size3, VanObject, VanObstacle, Vec3 } from './definitions'

export interface SnapCandidate {
  /** Model coordinate of a line worth snapping to. */
  value: Mm
  /** What produced it, for the alignment guide the canvas draws. */
  source: string
}

export interface SnapResult {
  position: Vec3
  /** Guides that were actually used, so the canvas can show them. */
  guides: Array<{ axis: 'x' | 'y' | 'z'; value: Mm }>
}

function roundToGrid(value: Mm, grid: Mm): Mm {
  if (grid <= 0) return Math.round(value)
  return Math.round(value / grid) * grid
}

/**
 * Collect the edges worth snapping to along each axis.
 *
 * Both faces of every object are candidates: you snap a cabinet's left edge to
 * another's right edge as often as you align their left edges.
 */
function collectCandidates(
  axis: 'x' | 'y' | 'z',
  interior: Size3,
  objects: VanObject[],
  obstacles: VanObstacle[],
  excludeIds: Set<string>,
): SnapCandidate[] {
  const extent = axis === 'x' ? interior.w : axis === 'y' ? interior.d : interior.h
  const sizeKey = axis === 'x' ? 'w' : axis === 'y' ? 'd' : 'h'

  const candidates: SnapCandidate[] = [
    { value: 0, source: axis === 'z' ? 'floor' : 'wall' },
    { value: extent, source: axis === 'z' ? 'roof' : 'wall' },
  ]

  for (const object of objects) {
    if (excludeIds.has(object.id)) continue
    candidates.push({ value: object.position[axis], source: object.name })
    candidates.push({
      value: object.position[axis] + object.size[sizeKey],
      source: object.name,
    })
  }

  for (const obstacle of obstacles) {
    candidates.push({ value: obstacle.position[axis], source: obstacle.name })
    candidates.push({
      value: obstacle.position[axis] + obstacle.size[sizeKey],
      source: obstacle.name,
    })
  }

  return candidates
}

/**
 * Snap one axis.
 *
 * Both the leading and trailing face of the dragged object are tested against
 * every candidate, and the closest match within tolerance wins.
 */
function snapAxis(
  proposed: Mm,
  extent: Mm,
  candidates: SnapCandidate[],
  grid: Mm,
  enabled: boolean,
): { value: Mm; guide: Mm | null } {
  if (enabled) {
    let best: { value: Mm; guide: Mm; distance: number } | null = null

    for (const candidate of candidates) {
      // Leading edge onto the candidate.
      const nearStart = Math.abs(candidate.value - proposed)
      if (nearStart <= SNAP_TOLERANCE_MM && (!best || nearStart < best.distance)) {
        best = { value: candidate.value, guide: candidate.value, distance: nearStart }
      }

      // Trailing edge onto the candidate.
      const nearEnd = Math.abs(candidate.value - (proposed + extent))
      if (nearEnd <= SNAP_TOLERANCE_MM && (!best || nearEnd < best.distance)) {
        best = { value: candidate.value - extent, guide: candidate.value, distance: nearEnd }
      }
    }

    if (best) return { value: best.value, guide: best.guide }
  }

  return { value: roundToGrid(proposed, grid), guide: null }
}

export function snapPosition(options: {
  proposed: Vec3
  size: Size3
  interior: Size3
  objects: VanObject[]
  obstacles: VanObstacle[]
  excludeIds: string[]
  gridMm: Mm
  snapToObjects: boolean
}): SnapResult {
  const exclude = new Set(options.excludeIds)
  const guides: SnapResult['guides'] = []

  const axes: Array<{ axis: 'x' | 'y' | 'z'; extent: Mm }> = [
    { axis: 'x', extent: options.size.w },
    { axis: 'y', extent: options.size.d },
    { axis: 'z', extent: options.size.h },
  ]

  const position: Vec3 = { ...options.proposed }

  for (const { axis, extent } of axes) {
    const candidates = collectCandidates(
      axis,
      options.interior,
      options.objects,
      options.obstacles,
      exclude,
    )

    const result = snapAxis(
      options.proposed[axis],
      extent,
      candidates,
      options.gridMm,
      options.snapToObjects,
    )

    position[axis] = result.value
    if (result.guide !== null) guides.push({ axis, value: result.guide })
  }

  return { position, guides }
}

/** Snap a single scalar, used by resize handles. */
export function snapScalar(
  proposed: Mm,
  candidates: Mm[],
  grid: Mm,
  snapToObjects: boolean,
): Mm {
  if (snapToObjects) {
    let best: { value: Mm; distance: number } | null = null
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - proposed)
      if (distance <= SNAP_TOLERANCE_MM && (!best || distance < best.distance)) {
        best = { value: candidate, distance }
      }
    }
    if (best) return best.value
  }

  return roundToGrid(proposed, grid)
}
