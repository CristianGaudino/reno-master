/**
 * Oriented bounding boxes.
 *
 * Objects can sit at any yaw, so their footprint is a rotated rectangle rather
 * than an axis-aligned one. Treating a rotated object as its axis-aligned bounds
 * would report conflicts between things that plainly do not touch, which is the
 * single fastest way to make an accuracy-focused tool untrustworthy.
 */

import type { Degrees, Mm, Point2, Rect2, Size3, Vec3 } from '../definitions'

/** A rectangle in the horizontal plane, possibly rotated. */
export interface Footprint {
  /** Centre of the rectangle. */
  cx: Mm
  cy: Mm
  /** Full extents before rotation. */
  w: Mm
  d: Mm
  /** Rotation clockwise, degrees. */
  yaw: Degrees
}

/** A footprint plus the vertical interval it occupies. */
export interface Box3 {
  footprint: Footprint
  zMin: Mm
  zMax: Mm
}

export function toRadians(degrees: Degrees): number {
  return (degrees * Math.PI) / 180
}

export function toDegrees(radians: number): Degrees {
  return (radians * 180) / Math.PI
}

/** Normalise an angle into [0, 360). */
export function normalizeAngle(degrees: Degrees): Degrees {
  const wrapped = degrees % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/**
 * Build a footprint from a min-corner position and size.
 *
 * Rotation is about the footprint centre, which is what users expect from a
 * rotate handle and keeps an object in place as it turns.
 */
export function footprintFrom(position: Vec3, size: Size3, yaw: Degrees): Footprint {
  return {
    cx: position.x + size.w / 2,
    cy: position.y + size.d / 2,
    w: size.w,
    d: size.d,
    yaw,
  }
}

export function box3From(position: Vec3, size: Size3, yaw: Degrees): Box3 {
  return {
    footprint: footprintFrom(position, size, yaw),
    zMin: position.z,
    zMax: position.z + size.h,
  }
}

/**
 * The four corners of a footprint, in consistent winding order.
 *
 * Screen y increases downward in the top view, so a positive (clockwise on
 * screen) yaw is a positive mathematical rotation in this coordinate system.
 */
export function footprintCorners(footprint: Footprint): Point2[] {
  const { cx, cy, w, d, yaw } = footprint
  const angle = toRadians(yaw)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const hw = w / 2
  const hd = d / 2

  const local: Point2[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ]

  return local.map((point) => ({
    x: cx + point.x * cos - point.y * sin,
    y: cy + point.x * sin + point.y * cos,
  }))
}

/** Corners of the footprint belonging to a box. */
export function boxCorners(box: Box3): Point2[] {
  return footprintCorners(box.footprint)
}

export interface Extent2 {
  minX: Mm
  maxX: Mm
  minY: Mm
  maxY: Mm
}

/**
 * Axis-aligned extent of a (possibly rotated) footprint.
 *
 * The single source of truth for "how much room does this actually take up".
 * Bounds checks, the elevation projections, the corridor scan and the clearance
 * rules all need it, and computing it independently in each of them is how the
 * views end up disagreeing with the warnings about where an object is.
 */
export function footprintExtent(footprint: Footprint): Extent2 {
  const { cx, cy, w, d, yaw } = footprint
  const radians = toRadians(yaw)
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))

  const halfWidth = (w * cos + d * sin) / 2
  const halfDepth = (w * sin + d * cos) / 2

  return {
    minX: cx - halfWidth,
    maxX: cx + halfWidth,
    minY: cy - halfDepth,
    maxY: cy + halfDepth,
  }
}

export function boxExtent(box: Box3): Extent2 {
  return footprintExtent(box.footprint)
}

/** Axis-aligned bounds of a footprint, as a rectangle. */
export function footprintBounds(footprint: Footprint): Rect2 {
  const extent = footprintExtent(footprint)
  return {
    x: extent.minX,
    y: extent.minY,
    w: extent.maxX - extent.minX,
    h: extent.maxY - extent.minY,
  }
}

/** Rotate a point about an arbitrary centre, clockwise by `degrees`. */
export function rotatePoint(point: Point2, centre: Point2, degrees: Degrees): Point2 {
  const angle = toRadians(degrees)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - centre.x
  const dy = point.y - centre.y
  return {
    x: centre.x + dx * cos - dy * sin,
    y: centre.y + dx * sin + dy * cos,
  }
}

/** Whether a point lies inside a footprint, tested in the footprint's own frame. */
export function footprintContainsPoint(footprint: Footprint, point: Point2): boolean {
  const local = rotatePoint(point, { x: footprint.cx, y: footprint.cy }, -footprint.yaw)
  return (
    Math.abs(local.x - footprint.cx) <= footprint.w / 2 &&
    Math.abs(local.y - footprint.cy) <= footprint.d / 2
  )
}

/** Vertical overlap between two boxes; negative means they are clear of each other. */
export function verticalOverlap(a: Box3, b: Box3): Mm {
  return Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin)
}
