import {
  BODY_RATIOS,
  COMFORTABLE_AISLE_WIDTH_MM,
  DOOR_EGRESS_CLEARANCE_MM,
  MIN_AISLE_WIDTH_MM,
  RULE_IDS,
} from '../../constants'
import type { Finding, Rule } from '../../definitions'
import { boxExtent, boxOf, measureCorridor } from '../../geometry'
import { formatLength } from '../../units'
import { findingId } from '../engine'
import { ergonomicFinding, judge, personaSummary } from './shared'

/**
 * Aisle width for circulation.
 *
 * Measures the narrowest straight walkway along the van, across the height band
 * a walking body actually occupies — so a water tank under a raised bed does not
 * count against it, and neither does an overhead locker.
 *
 * Known limitation, stated in the README rather than hidden: this measures a
 * straight corridor. A layout with an L-shaped route around a corner can measure
 * narrower than it really walks.
 */
export const aisleWidthRule: Rule = {
  id: RULE_IDS.AISLE_WIDTH,
  name: 'Aisle width',
  description: 'Whether there is room to walk through the van.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    if (ctx.obstructing.length === 0) return []

    const result = measureCorridor(
      ctx.van.interior,
      ctx.van.taper,
      ctx.obstructing.map((object) => ({ id: object.id, box: boxOf(object) })),
    )

    const units = ctx.settings.unitSystem

    // A body needs its shoulders through, plus a little clearance. Below the
    // absolute minimum this stops being a comfort question and becomes an error.
    const judged = judge(ctx, result.minWidth, (height) =>
      Math.max(COMFORTABLE_AISLE_WIDTH_MM, height * BODY_RATIOS.shoulderBreadth + 60),
    )

    if (!judged.anyFails) return []

    const impassable = result.minWidth < MIN_AISLE_WIDTH_MM

    return [
      ergonomicFinding({
        id: findingId(RULE_IDS.AISLE_WIDTH),
        ruleId: RULE_IDS.AISLE_WIDTH,
        ruleName: 'Aisle width',
        severity: impassable ? 'error' : 'warning',
        message: `Narrowest walkway: ${formatLength(Math.round(result.minWidth), units)}`,
        detail: impassable
          ? `Below ${formatLength(
              MIN_AISLE_WIDTH_MM,
              units,
            )} nobody gets through at all, whatever their size.`
          : personaSummary(judged, ctx),
        objectIds: result.culpritIds,
        measured: Math.round(result.minWidth),
        threshold: Math.round(judged.worstThreshold),
        judged,
        focus: {
          x: ctx.van.interior.w / 2,
          y: result.atY,
          z: 1000,
        },
      }),
    ]
  },
}

/**
 * Room to open a door and get past it.
 *
 * Distinct from the aperture-blocked error: nothing is fouling the door, there
 * is simply not enough floor in front of it to stand while you use it.
 */
export const doorEgressRule: Rule = {
  id: RULE_IDS.DOOR_EGRESS,
  name: 'Room at the door',
  description: 'Whether there is standing room inside a doorway.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    const apertures = ctx.van.obstacles.filter(
      (obstacle) => obstacle.kind === 'aperture_side' || obstacle.kind === 'aperture_rear',
    )

    for (const aperture of apertures) {
      const { depth: clearance, blocker } = clearanceInFrontOf(ctx, aperture)
      if (clearance >= DOOR_EGRESS_CLEARANCE_MM) continue

      const judged = judge(ctx, clearance, () => DOOR_EGRESS_CLEARANCE_MM)

      findings.push(
        ergonomicFinding({
          id: findingId(RULE_IDS.DOOR_EGRESS, aperture.id),
          ruleId: RULE_IDS.DOOR_EGRESS,
          ruleName: 'Room at the door',
          message: `Only ${formatLength(
            Math.round(clearance),
            units,
          )} of floor inside the ${aperture.name.toLowerCase()}`,
          detail: blocker
            ? `${blocker.name} is right at the opening. You want about ${formatLength(
                DOOR_EGRESS_CLEARANCE_MM,
                units,
              )} of floor to step in and turn around — which a bed across the back deliberately gives up, so this may be exactly what you intended.`
            : `You want about ${formatLength(
                DOOR_EGRESS_CLEARANCE_MM,
                units,
              )} to step in and turn around with the door open.`,
          objectIds: blocker ? [blocker.id] : [],
          measured: Math.round(clearance),
          threshold: DOOR_EGRESS_CLEARANCE_MM,
          judged,
          focus: { ...aperture.position },
        }),
      )
    }

    return findings
  },
}

/** How finely the doorway is sampled when looking for somewhere to step in. */
const EGRESS_SAMPLE_STEP_MM = 50

/**
 * Depth of clear floor available inside an aperture.
 *
 * The doorway is sampled across its width and the **best** step-in depth is
 * taken, not the worst. What matters is whether there is somewhere to put your
 * feet, and taking the worst point means a bed platform clipping the far end of
 * a 1300mm sliding door reads as blocking the whole opening — which it plainly
 * does not.
 *
 * The side door faces across the van, so depth runs along x; the rear doors face
 * along it, so depth runs along y.
 */
function clearanceInFrontOf(
  ctx: SceneContextLike,
  aperture: {
    kind: string
    position: { x: number; y: number; z: number }
    size: { w: number; d: number; h: number }
  },
): { depth: number; blocker: { id: string; name: string } | null } {
  const alongX = aperture.kind === 'aperture_side'
  const { interior } = ctx.van

  // Only things at body height are in the way of stepping in.
  const blockers = ctx.obstructing
    .filter((object) => object.position.z <= 1200)
    .map((object) => ({ object, extent: boxExtent(boxOf(object)) }))

  // Sample across the opening: along y for a side door, along x for the rear.
  const from = alongX ? aperture.position.y : aperture.position.x
  const span = alongX ? aperture.size.d : aperture.size.w
  const nearSide = alongX ? aperture.position.x < interior.w / 2 : false

  let best = -1
  let bestBlocker: { id: string; name: string } | null = null

  for (let offset = 0; offset <= span; offset += EGRESS_SAMPLE_STEP_MM) {
    const at = from + offset
    let depth = alongX ? interior.w : interior.d
    let closest: { id: string; name: string } | null = null

    for (const { object, extent } of blockers) {
      let candidate: number
      if (alongX) {
        if (at < extent.minY || at > extent.maxY) continue
        candidate = nearSide ? extent.minX : interior.w - extent.maxX
      } else {
        if (at < extent.minX || at > extent.maxX) continue
        candidate = interior.d - extent.maxY
      }

      if (candidate < depth) {
        depth = candidate
        closest = { id: object.id, name: object.name }
      }
    }

    // Keep whatever is limiting the *best* place to step in — that is the one
    // the user would have to move to gain anything.
    const clear = Math.max(0, depth)
    if (clear > best) {
      best = clear
      bestBlocker = closest
    }
  }

  return { depth: Math.max(0, best), blocker: bestBlocker }
}

/** Narrow structural type so this helper does not need the whole context. */
interface SceneContextLike {
  van: { interior: { w: number; d: number; h: number } }
  obstructing: Array<Parameters<typeof boxOf>[0] & { id: string; name: string }>
}
