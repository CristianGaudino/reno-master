/**
 * 3D intersection between objects.
 *
 * Two objects collide only if their footprints overlap in plan *and* their
 * vertical extents overlap. Checking the footprint alone is the classic bug: an
 * overhead locker directly above a worktop is a perfectly normal arrangement,
 * not a conflict.
 */

import { CONTACT_TOLERANCE_MM } from '../constants'
import type { Mm, VanObject, VanObstacle } from '../definitions'
import { box3From, boxExtent, verticalOverlap, type Box3 } from './obb'
import { footprintsOverlap } from './sat'

export interface Intersection3D {
  intersecting: boolean
  /** Horizontal penetration in mm; 0 when the footprints are clear. */
  horizontal: Mm
  /** Vertical overlap in mm; negative when one sits clear above the other. */
  vertical: Mm
}

export function boxOf(object: VanObject | VanObstacle): Box3 {
  return box3From(object.position, object.size, 'yaw' in object ? object.yaw : 0)
}

export function intersects3D(
  a: Box3,
  b: Box3,
  tolerance: Mm = CONTACT_TOLERANCE_MM,
): Intersection3D {
  const vertical = verticalOverlap(a, b)
  if (vertical <= tolerance) {
    return { intersecting: false, horizontal: 0, vertical }
  }

  const horizontal = footprintsOverlap(a.footprint, b.footprint, tolerance)
  if (!horizontal.overlapping) {
    return { intersecting: false, horizontal: 0, vertical }
  }

  return {
    intersecting: true,
    horizontal: horizontal.penetration,
    vertical: vertical - tolerance,
  }
}

/** Convenience wrapper for two placed objects. */
export function objectsIntersect(
  a: VanObject | VanObstacle,
  b: VanObject | VanObstacle,
  tolerance: Mm = CONTACT_TOLERANCE_MM,
): Intersection3D {
  return intersects3D(boxOf(a), boxOf(b), tolerance)
}

/**
 * Whether a box is fully inside a rectangular volume.
 *
 * Only used for the simple custom-van case; presets go through the taper-aware
 * check in `frame.ts`, because a box that fits the nominal width can still foul
 * a wall that leans inward above waist height.
 */
export function boxWithinBounds(
  box: Box3,
  bounds: { w: Mm; d: Mm; h: Mm },
  tolerance: Mm = CONTACT_TOLERANCE_MM,
): { inside: boolean; exceeded: Array<'left' | 'right' | 'front' | 'back' | 'floor' | 'roof'>; worst: Mm } {
  const exceeded: Array<'left' | 'right' | 'front' | 'back' | 'floor' | 'roof'> = []
  let worst = 0

  const record = (
    side: 'left' | 'right' | 'front' | 'back' | 'floor' | 'roof',
    amount: Mm,
  ) => {
    if (amount > tolerance) {
      exceeded.push(side)
      if (amount > worst) worst = amount
    }
  }

  // Use axis-aligned bounds of the rotated footprint: a rotated object needs the
  // space its corners actually sweep into, not its unrotated width.
  const corners = boxExtent(box)

  record('left', -corners.minX)
  record('right', corners.maxX - bounds.w)
  record('front', -corners.minY)
  record('back', corners.maxY - bounds.d)
  record('floor', -box.zMin)
  record('roof', box.zMax - bounds.h)

  return { inside: exceeded.length === 0, exceeded, worst }
}

/**
 * Shortest horizontal gap between two footprints, in mm.
 *
 * Returns 0 when they overlap. Used by clearance rules that care how much room
 * is left rather than whether something collides.
 */
export function horizontalGap(a: Box3, b: Box3): Mm {
  const result = footprintsOverlap(a.footprint, b.footprint, 0)
  if (result.overlapping) return 0

  const extentA = boxExtent(a)
  const extentB = boxExtent(b)

  const dx = Math.max(0, Math.max(extentA.minX - extentB.maxX, extentB.minX - extentA.maxX))
  const dy = Math.max(0, Math.max(extentA.minY - extentB.maxY, extentB.minY - extentA.maxY))

  return Math.hypot(dx, dy)
}
