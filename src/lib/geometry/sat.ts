/**
 * Separating-axis test for convex polygons in the plane.
 *
 * Two convex shapes are disjoint if and only if some axis exists on which their
 * projections do not overlap. For rectangles the only candidate axes are the
 * edge normals of each shape, so the test is exact and cheap — no sampling, no
 * tolerance fudging beyond the deliberate contact allowance.
 */

import type { Mm, Point2 } from '../definitions'
import { CONTACT_TOLERANCE_MM } from '../constants'
import { footprintCorners, type Footprint } from './obb'

export interface OverlapResult {
  overlapping: boolean
  /**
   * Smallest translation distance that would separate the shapes. Zero when
   * they are already apart. Lets a warning say how far in something is rather
   * than only that it collides.
   */
  penetration: Mm
  /** Direction of that translation, pointing from `a` toward `b`. */
  axis: Point2
}

function normalize(vector: Point2): Point2 {
  const length = Math.hypot(vector.x, vector.y)
  if (length === 0) return { x: 0, y: 0 }
  return { x: vector.x / length, y: vector.y / length }
}

/** Outward normals of each polygon edge, which are the only axes worth testing. */
function edgeNormals(points: Point2[]): Point2[] {
  const normals: Point2[] = []
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!
    const next = points[(i + 1) % points.length]!
    normals.push(normalize({ x: -(next.y - current.y), y: next.x - current.x }))
  }
  return normals
}

function projectOnto(points: Point2[], axis: Point2): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const point of points) {
    const value = point.x * axis.x + point.y * axis.y
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

/**
 * Test two convex polygons for overlap.
 *
 * `tolerance` is subtracted from the measured penetration, so shapes placed
 * flush against one another read as touching rather than colliding. Objects
 * butted up against each other are the normal case in a van build and must not
 * raise a conflict.
 */
export function polygonsOverlap(
  a: Point2[],
  b: Point2[],
  tolerance: Mm = CONTACT_TOLERANCE_MM,
): OverlapResult {
  const axes = [...edgeNormals(a), ...edgeNormals(b)]

  let minPenetration = Infinity
  let minAxis: Point2 = { x: 0, y: 0 }

  for (const axis of axes) {
    if (axis.x === 0 && axis.y === 0) continue

    const projectionA = projectOnto(a, axis)
    const projectionB = projectOnto(b, axis)

    const overlap =
      Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min)

    // A single separating axis is proof of disjointness; stop immediately.
    if (overlap <= tolerance) {
      return { overlapping: false, penetration: 0, axis }
    }

    if (overlap < minPenetration) {
      minPenetration = overlap
      minAxis = axis
    }
  }

  return {
    overlapping: true,
    penetration: minPenetration - tolerance,
    axis: minAxis,
  }
}

/** Convenience wrapper for the common case of two object footprints. */
export function footprintsOverlap(
  a: Footprint,
  b: Footprint,
  tolerance: Mm = CONTACT_TOLERANCE_MM,
): OverlapResult {
  return polygonsOverlap(footprintCorners(a), footprintCorners(b), tolerance)
}
