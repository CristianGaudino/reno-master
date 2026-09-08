/**
 * Projection of the 3D model into each 2D view.
 *
 * This is the abstraction that makes three views one editor. Rendering,
 * hit-testing and drag handling all go through here rather than branching per
 * view, so moving something in the side elevation writes the same record the
 * floor plan reads — and adding a 3D view later is a rendering job rather than a
 * rewrite, which is what spec section 1 asks for.
 */

import type { Mm, Point2, Rect2, Size3, Vec3, ViewMode } from '../definitions'
import { VIEW_AXES } from './frame'
import { footprintCorners, footprintExtent, footprintFrom } from './obb'

/** An object as it appears in one view. */
export interface Projected {
  /** Axis-aligned bounds in view coordinates (u right, v up/down per view). */
  rect: Rect2
  /**
   * Exact outline in view coordinates. In the top view this is the rotated
   * footprint; in the elevations a rotated box silhouettes to its axis-aligned
   * extent, so the outline equals the rect.
   */
  outline: Point2[]
  /** Extent along the axis being looked down. */
  throughMin: Mm
  throughMax: Mm
}

/** Read the component of a position that maps to a given view axis. */
function axisValue(position: Vec3, axis: keyof Vec3): Mm {
  return position[axis]
}

function sizeValue(size: Size3, axis: keyof Size3): Mm {
  return size[axis]
}

/**
 * Extents of a rotated footprint, as `[min, max]` pairs per axis.
 *
 * A box rotated about z silhouettes, when viewed along x or y, to exactly this
 * axis-aligned extent — so the elevations are exact, not approximate.
 */
function rotatedExtent(footprint: Parameters<typeof footprintExtent>[0]): {
  x: [Mm, Mm]
  y: [Mm, Mm]
} {
  const extent = footprintExtent(footprint)
  return { x: [extent.minX, extent.maxX], y: [extent.minY, extent.maxY] }
}

export interface Placeable {
  position: Vec3
  size: Size3
  yaw: number
}

/**
 * Project a placed object into a view.
 *
 * View coordinates always run u to the right and v downward in screen terms.
 * For the elevations the model's +z is up, so v is flipped here rather than in
 * the renderer — keeping the flip in one place means hit-testing and rendering
 * cannot disagree about which way is up.
 */
export function projectObject(object: Placeable, view: ViewMode, interior: Size3): Projected {
  const footprint = footprintFrom(object.position, object.size, object.yaw)
  const extent = rotatedExtent(footprint)

  const zMin = object.position.z
  const zMax = object.position.z + object.size.h

  if (view === 'top') {
    const outline = footprintCorners(footprint)
    return {
      rect: {
        x: extent.x[0],
        y: extent.y[0],
        w: extent.x[1] - extent.x[0],
        h: extent.y[1] - extent.y[0],
      },
      outline,
      throughMin: zMin,
      throughMax: zMax,
    }
  }

  // Elevations: horizontal axis comes from the rotated extent, vertical axis is
  // z flipped so that the roof is at the top of the screen.
  const horizontal = view === 'side' ? extent.y : extent.x
  const rect: Rect2 = {
    x: horizontal[0],
    y: interior.h - zMax,
    w: horizontal[1] - horizontal[0],
    h: zMax - zMin,
  }

  const through = view === 'side' ? extent.x : extent.y

  return {
    rect,
    outline: [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ],
    throughMin: through[0],
    throughMax: through[1],
  }
}

/**
 * Convert a drag in view coordinates back into a model-space delta.
 *
 * The v axis is negated for elevations to undo the flip applied above, so
 * dragging a cabinet up the screen raises its z.
 */
export function viewDeltaToModel(
  du: number,
  dv: number,
  view: ViewMode,
): Partial<Vec3> {
  const axes = VIEW_AXES[view]
  const delta: Partial<Vec3> = {}
  delta[axes.u] = du
  delta[axes.v] = view === 'top' ? dv : -dv
  return delta
}

/**
 * Which size components a resize handle in this view controls.
 *
 * The through-axis dimension is not editable from this view — you cannot set a
 * cabinet's depth by dragging its side elevation — so the editor hides those
 * handles rather than silently doing nothing.
 */
export function viewSizeAxes(view: ViewMode): { u: keyof Size3; v: keyof Size3 } {
  const axes = VIEW_AXES[view]
  return { u: axes.uSize, v: axes.vSize }
}

export function viewPositionAxes(view: ViewMode): { u: keyof Vec3; v: keyof Vec3 } {
  const axes = VIEW_AXES[view]
  return { u: axes.u, v: axes.v }
}

/** The model axis being looked along in this view. */
export function throughAxis(view: ViewMode): keyof Vec3 {
  return VIEW_AXES[view].through
}

/** Size of the whole van interior as it appears in a view. */
export function interiorRect(interior: Size3, view: ViewMode): Rect2 {
  const axes = VIEW_AXES[view]
  return {
    x: 0,
    y: 0,
    w: sizeValue(interior, axes.uSize),
    h: sizeValue(interior, axes.vSize),
  }
}

/**
 * Whether an object is intersected by the section cut.
 *
 * Only meaningful in the top view: at 12" you see the bed platform and cabinet
 * bases, at 55" the overhead lockers and nothing else (spec section 1).
 */
export function isAtCutHeight(object: Placeable, cutHeight: Mm): boolean {
  const zMin = object.position.z
  const zMax = zMin + object.size.h
  return cutHeight >= zMin && cutHeight < zMax
}

/** Whether an object sits entirely above the cut, and so renders ghosted. */
export function isAboveCut(object: Placeable, cutHeight: Mm): boolean {
  return object.position.z > cutHeight
}

/** Convert a point in view coordinates back to model coordinates on a given plane. */
export function viewPointToModel(
  point: Point2,
  view: ViewMode,
  interior: Size3,
  throughValue: Mm,
): Vec3 {
  const axes = VIEW_AXES[view]
  const result: Vec3 = { x: 0, y: 0, z: 0 }
  result[axes.u] = point.x
  result[axes.v] = view === 'top' ? point.y : interior.h - point.y
  result[axes.through] = throughValue
  return result
}

/** Convert a model point into view coordinates. */
export function modelPointToView(point: Vec3, view: ViewMode, interior: Size3): Point2 {
  const axes = VIEW_AXES[view]
  const u = axisValue(point, axes.u)
  const v = axisValue(point, axes.v)
  return { x: u, y: view === 'top' ? v : interior.h - v }
}
