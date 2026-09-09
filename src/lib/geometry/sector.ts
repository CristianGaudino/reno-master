/**
 * Swept volumes for articulated objects.
 *
 * Spec section 2 calls this the highest-value check in the app: the fridge door
 * that cannot open because the bed is three inches too close. So the sweep is
 * evaluated properly rather than approximated by a bounding circle.
 *
 * The leaf is stepped through its arc and tested at each pose. That costs a
 * handful of cheap SAT tests, and buys the thing a bounding circle can never
 * give: the exact angle at which the door fouls, so the warning can say
 * "fouls the bed platform at 62 degrees of 90" instead of merely "blocked".
 */

import { SWING_SAMPLE_STEP_DEG } from '../constants'
import type {
  Articulation,
  ArticulationKind,
  CatalogItem,
  Degrees,
  Mm,
  Point2,
  Size3,
  Vec3,
} from '../definitions'
import { boxCorners, boxExtent, toRadians, type Box3 } from './obb'
import { polygonsOverlap } from './sat'

/** One sampled position of a swinging leaf. */
export interface SweepPose {
  angle: Degrees
  polygon: Point2[]
}

/**
 * The leaf rectangle at a given angle.
 *
 * Angles are clockwise from +x, matching the yaw convention in `obb.ts`, so a
 * door and the cabinet it hangs on rotate the same way.
 */
export function leafPolygonAt(articulation: Articulation, angle: Degrees): Point2[] {
  const { hinge, leafLength, leafThickness } = articulation
  const radians = toRadians(angle)
  const dx = Math.cos(radians)
  const dy = Math.sin(radians)
  // Perpendicular, giving the leaf its thickness.
  const px = -dy
  const py = dx

  return [
    { x: hinge.x, y: hinge.y },
    { x: hinge.x + leafLength * dx, y: hinge.y + leafLength * dy },
    {
      x: hinge.x + leafLength * dx + leafThickness * px,
      y: hinge.y + leafLength * dy + leafThickness * py,
    },
    { x: hinge.x + leafThickness * px, y: hinge.y + leafThickness * py },
  ]
}

/**
 * Sample the leaf through its full travel.
 *
 * The final angle is always included even when the sweep is not a whole number
 * of steps, so a door that only fouls at the very end of its travel is still
 * caught.
 */
export function sweepPoses(
  articulation: Articulation,
  stepDegrees: number = SWING_SAMPLE_STEP_DEG,
): SweepPose[] {
  const { startAngle, sweepAngle } = articulation
  const direction = Math.sign(sweepAngle) || 1
  const magnitude = Math.abs(sweepAngle)
  const step = Math.max(1, Math.abs(stepDegrees))

  const poses: SweepPose[] = []
  for (let travelled = 0; travelled < magnitude; travelled += step) {
    const angle = startAngle + direction * travelled
    poses.push({ angle, polygon: leafPolygonAt(articulation, angle) })
  }

  const finalAngle = startAngle + sweepAngle
  poses.push({ angle: finalAngle, polygon: leafPolygonAt(articulation, finalAngle) })

  return poses
}

/**
 * A sliding door's swept volume.
 *
 * Slides translate rather than rotate, so the swept area is the leaf smeared
 * along its travel — represented as the rectangle covering start and end.
 */
export function slidePolygon(articulation: Articulation): Point2[] {
  const distance = articulation.slideDistance ?? articulation.leafLength
  const radians = toRadians(articulation.startAngle)
  const dx = Math.cos(radians)
  const dy = Math.sin(radians)
  const px = -dy
  const py = dx
  const total = articulation.leafLength + distance

  return [
    { x: articulation.hinge.x, y: articulation.hinge.y },
    { x: articulation.hinge.x + total * dx, y: articulation.hinge.y + total * dy },
    {
      x: articulation.hinge.x + total * dx + articulation.leafThickness * px,
      y: articulation.hinge.y + total * dy + articulation.leafThickness * py,
    },
    {
      x: articulation.hinge.x + articulation.leafThickness * px,
      y: articulation.hinge.y + articulation.leafThickness * py,
    },
  ]
}

/** Poses to test for an articulation, whichever way it moves. */
export function posesFor(
  articulation: Articulation,
  stepDegrees: number = SWING_SAMPLE_STEP_DEG,
): SweepPose[] {
  if (articulation.kind === 'slide') {
    return [{ angle: articulation.startAngle, polygon: slidePolygon(articulation) }]
  }
  return sweepPoses(articulation, stepDegrees)
}

export interface Blocker {
  id: string
  name: string
  /** Angle at which this blocker is first touched. */
  angle: Degrees
}

/**
 * How far from its hinge a leaf can possibly reach.
 *
 * The leaf sweeps inside a circle of this radius, so anything further away
 * cannot be touched at any angle. Used to reject candidates before the
 * per-pose work — exact rather than approximate, since nothing outside the
 * circle can be reached however finely the sweep is sampled.
 */
export function swingReach(articulation: Articulation): Mm {
  const extent =
    articulation.kind === 'slide'
      ? articulation.leafLength + (articulation.slideDistance ?? articulation.leafLength)
      : articulation.leafLength
  return Math.hypot(extent, articulation.leafThickness)
}

/** Distance from a point to an axis-aligned box; zero when inside it. */
function distanceToBox(point: Point2, box: Box3): Mm {
  const extent = boxExtent(box)
  const dx = Math.max(extent.minX - point.x, 0, point.x - extent.maxX)
  const dy = Math.max(extent.minY - point.y, 0, point.y - extent.maxY)
  return Math.hypot(dx, dy)
}

export interface SwingResult {
  blocked: boolean
  /** How far the leaf can travel before touching anything, in degrees. */
  maxOpenAngle: Degrees
  /** Full travel it was asked for. */
  requestedAngle: Degrees
  /** Everything in the way, each with the angle at which it is first hit. */
  blockers: Blocker[]
}

/** Anything a swing can be tested against. */
export interface SwingCandidate {
  id: string
  name: string
  box: Box3
}

/**
 * Test a swing against candidate obstructions.
 *
 * Candidates whose vertical extent does not overlap the leaf's `zRange` are
 * skipped: a fridge door at knee height is unobstructed by an overhead locker,
 * and reporting otherwise would be exactly the kind of false positive that makes
 * people stop trusting the warnings.
 */
export function evaluateSwing(
  articulation: Articulation,
  candidates: SwingCandidate[],
  stepDegrees: number = SWING_SAMPLE_STEP_DEG,
): SwingResult {
  // Two cheap rejections before any pose work: candidates that do not share the
  // leaf's height, and candidates further from the hinge than the leaf can
  // reach. At a hundred objects this is the difference between testing every
  // object at every sampled angle and testing the two or three actually near
  // the door.
  const reach = swingReach(articulation)
  const relevant = candidates.filter((candidate) => {
    if (candidate.box.zMax <= articulation.zRange.min) return false
    if (candidate.box.zMin >= articulation.zRange.max) return false
    return distanceToBox(articulation.hinge, candidate.box) <= reach
  })

  if (relevant.length === 0) {
    return {
      blocked: false,
      maxOpenAngle: Math.abs(articulation.sweepAngle),
      requestedAngle: Math.abs(articulation.sweepAngle),
      blockers: [],
    }
  }

  const poses = posesFor(articulation, stepDegrees)
  const blockers = new Map<string, Blocker>()
  let maxOpen = Math.abs(articulation.sweepAngle)
  let foundFirstBlock = false

  for (const pose of poses) {
    // Every candidate is already a known blocker: further poses cannot change
    // the answer.
    if (blockers.size === relevant.length && foundFirstBlock) break

    const travelled = Math.abs(pose.angle - articulation.startAngle)

    for (const candidate of relevant) {
      if (blockers.has(candidate.id)) continue
      const result = polygonsOverlap(pose.polygon, boxCorners(candidate.box))
      if (!result.overlapping) continue

      if (!blockers.has(candidate.id)) {
        blockers.set(candidate.id, {
          id: candidate.id,
          name: candidate.name,
          angle: Math.round(travelled),
        })
      }

      // The first contact anywhere in the sweep caps how far the door opens.
      if (!foundFirstBlock) {
        // Back off one step: the last sampled pose that was clear is the real
        // limit, and reporting the first fouling pose would overstate it.
        maxOpen = Math.max(0, Math.round(travelled - Math.abs(stepDegrees)))
        foundFirstBlock = true
      }
    }
  }

  return {
    blocked: blockers.size > 0,
    maxOpenAngle: maxOpen,
    requestedAngle: Math.abs(articulation.sweepAngle),
    blockers: [...blockers.values()].sort((a, b) => a.angle - b.angle),
  }
}

/**
 * Build an `Articulation` in van coordinates from a catalog template.
 *
 * The catalog describes a door relative to its own cabinet ("hinged on the
 * front-left corner, opening forward") because that is how a person thinks about
 * it. Placing the object resolves that into absolute coordinates, so later
 * moving or rotating the cabinet carries its door along correctly.
 */
export function articulationFromTemplate(
  template: NonNullable<CatalogItem['articulationTemplate']>,
  position: Vec3,
  size: Size3,
  yaw: Degrees,
): Articulation {
  // Corner in the object's own unrotated frame.
  const local: Point2 =
    template.hingeCorner === 'front-left'
      ? { x: 0, y: 0 }
      : template.hingeCorner === 'front-right'
        ? { x: size.w, y: 0 }
        : template.hingeCorner === 'back-left'
          ? { x: 0, y: size.d }
          : { x: size.w, y: size.d }

  // Rotate that corner about the footprint centre, matching how the object
  // itself is rotated.
  const centre = { x: size.w / 2, y: size.d / 2 }
  const radians = toRadians(yaw)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = local.x - centre.x
  const dy = local.y - centre.y

  const hinge = {
    x: position.x + centre.x + dx * cos - dy * sin,
    y: position.y + centre.y + dx * sin + dy * cos,
  }

  /*
   * A closed door lies flat against the face it is mounted on — it does not
   * stick out perpendicular. So the leaf's resting angle runs *along* that
   * face, from the hinge toward the far corner of it, and opening swings the
   * leaf out toward the face's outward normal.
   *
   * Getting this backwards puts every door at ninety degrees before anyone has
   * touched it, which then reads as the cabinet fouling its neighbour while
   * shut. Since "can this door open" is the check the whole tool is built
   * around, it is worth deriving properly rather than hard-coding an angle.
   */
  const outward: Degrees =
    template.doorFace === 'right'
      ? 0
      : template.doorFace === 'back'
        ? 90
        : template.doorFace === 'left'
          ? 180
          : 270

  // Along the face, away from the hinge corner.
  const hingeAtLowEnd =
    template.doorFace === 'front' || template.doorFace === 'back'
      ? template.hingeCorner === 'front-left' || template.hingeCorner === 'back-left'
      : template.hingeCorner === 'front-left' || template.hingeCorner === 'front-right'

  const alongFace: Degrees =
    template.doorFace === 'front' || template.doorFace === 'back'
      ? hingeAtLowEnd
        ? 0 // toward +x
        : 180 // toward -x
      : hingeAtLowEnd
        ? 90 // toward +y
        : 270 // toward -y

  // Swing toward the outward normal, whichever way round that is.
  const direction = Math.sign(signedDelta(alongFace, outward)) || 1

  return {
    kind: template.kind as ArticulationKind,
    hinge,
    leafLength: template.leafLength,
    leafThickness: template.leafThickness,
    startAngle: alongFace + yaw,
    sweepAngle: Math.abs(template.sweepAngle) * direction,
    zRange: {
      min: position.z + template.zOffsetMin,
      max: position.z + template.zOffsetMax,
    },
  }
}

/** Shortest signed rotation from one angle to another, in (-180, 180]. */
function signedDelta(from: Degrees, to: Degrees): Degrees {
  let delta = (to - from) % 360
  if (delta > 180) delta -= 360
  if (delta <= -180) delta += 360
  return delta
}

/**
 * Move an existing articulation with its parent object.
 *
 * Called whenever an articulated object is dragged or rotated, so the hinge
 * stays welded to the cabinet it belongs to.
 */
export function transformArticulation(
  articulation: Articulation,
  from: { position: Vec3; size: Size3; yaw: Degrees },
  to: { position: Vec3; size: Size3; yaw: Degrees },
): Articulation {
  // Express the hinge relative to the old footprint centre, undo the old
  // rotation, re-apply the new one, then re-anchor to the new centre.
  const oldCentre = { x: from.position.x + from.size.w / 2, y: from.position.y + from.size.d / 2 }
  const newCentre = { x: to.position.x + to.size.w / 2, y: to.position.y + to.size.d / 2 }

  const unrotated = rotateAbout(articulation.hinge, oldCentre, -from.yaw)
  const scaled = {
    x: oldCentre.x + (unrotated.x - oldCentre.x) * safeRatio(to.size.w, from.size.w),
    y: oldCentre.y + (unrotated.y - oldCentre.y) * safeRatio(to.size.d, from.size.d),
  }
  const rerotated = rotateAbout(scaled, oldCentre, to.yaw)

  const hinge = {
    x: rerotated.x + (newCentre.x - oldCentre.x),
    y: rerotated.y + (newCentre.y - oldCentre.y),
  }

  const zSpan = articulation.zRange.max - articulation.zRange.min
  const zOffset = articulation.zRange.min - from.position.z

  return {
    ...articulation,
    hinge,
    startAngle: articulation.startAngle + (to.yaw - from.yaw),
    zRange: {
      min: to.position.z + zOffset,
      max: to.position.z + zOffset + zSpan,
    },
  }
}

function safeRatio(next: number, previous: number): number {
  return previous === 0 ? 1 : next / previous
}

function rotateAbout(point: Point2, centre: Point2, degrees: Degrees): Point2 {
  const radians = toRadians(degrees)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - centre.x
  const dy = point.y - centre.y
  return {
    x: centre.x + dx * cos - dy * sin,
    y: centre.y + dx * sin + dy * cos,
  }
}

/** SVG path for drawing a swing arc, in the top-down view. */
export function swingArcPath(articulation: Articulation): string {
  const { hinge, leafLength, startAngle, sweepAngle } = articulation
  const startRad = toRadians(startAngle)
  const endRad = toRadians(startAngle + sweepAngle)

  const start = {
    x: hinge.x + leafLength * Math.cos(startRad),
    y: hinge.y + leafLength * Math.sin(startRad),
  }
  const end = {
    x: hinge.x + leafLength * Math.cos(endRad),
    y: hinge.y + leafLength * Math.sin(endRad),
  }

  const largeArc = Math.abs(sweepAngle) > 180 ? 1 : 0
  const sweepFlag = sweepAngle > 0 ? 1 : 0

  return [
    `M ${hinge.x} ${hinge.y}`,
    `L ${start.x} ${start.y}`,
    `A ${leafLength} ${leafLength} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

/** Millimetre length of the arc a leaf tip travels; used for clearance messaging. */
export function arcLength(articulation: Articulation): Mm {
  return Math.abs(toRadians(articulation.sweepAngle)) * articulation.leafLength
}
