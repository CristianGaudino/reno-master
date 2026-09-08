import {
  BODY_RATIOS,
  RULE_IDS,
  SITTING_HEADROOM_ALLOWANCE_MM,
  STANDING_HEADROOM_ALLOWANCE_MM,
} from '../../constants'
import type { Finding, Rule } from '../../definitions'
import { formatLength } from '../../units'
import { findingId } from '../engine'
import {
  clearanceAbove,
  ergonomicFinding,
  judge,
  lowestStandingSpot,
  personaSummary,
} from './shared'

/**
 * Standing headroom where a person actually stands.
 *
 * Measured over the floor a body can occupy, ignoring the space above cabinets —
 * you cannot stand inside a cabinet, so clearance there tells you nothing.
 */
export const standingHeadroomRule: Rule = {
  id: RULE_IDS.STANDING_HEADROOM,
  name: 'Standing headroom',
  description: 'Whether you can stand upright where you walk and work.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    const spot = lowestStandingSpot(ctx)
    if (!spot) return []

    const judged = judge(
      ctx,
      spot.clearHeight,
      (height) => height + STANDING_HEADROOM_ALLOWANCE_MM,
    )
    if (!judged.anyFails) return []

    const units = ctx.settings.unitSystem
    const where = spot.limitedBy
      ? `under the ${spot.limitedBy.toLowerCase()}`
      : 'at the roof line'

    return [
      ergonomicFinding({
        id: findingId(RULE_IDS.STANDING_HEADROOM),
        ruleId: RULE_IDS.STANDING_HEADROOM,
        ruleName: 'Standing headroom',
        message: `Standing headroom ${where}: ${formatLength(
          Math.round(spot.clearHeight),
          units,
        )}`,
        detail: personaSummary(judged, ctx),
        objectIds: [],
        measured: Math.round(spot.clearHeight),
        threshold: judged.worstThreshold,
        judged,
        focus: { x: spot.x, y: spot.y, z: spot.clearHeight },
      }),
    ]
  },
}

/**
 * Sitting headroom over beds and seating.
 *
 * Measured from the surface you sit on to whatever is above it. This is the
 * number that decides whether you can sit up in bed, which people care about far
 * more than they expect to before they have lived in the van.
 */
export const sittingHeadroomRule: Rule = {
  id: RULE_IDS.SITTING_HEADROOM,
  name: 'Sitting headroom',
  description: 'Whether you can sit upright on the bed and seating.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    const surfaces = ctx.objects.filter(
      (object) => object.category === 'sleeping' || object.category === 'seating',
    )

    for (const surface of surfaces) {
      const { clearance, limitedBy } = clearanceAbove(ctx, surface)

      const judged = judge(
        ctx,
        clearance,
        (height) => height * BODY_RATIOS.sittingHeight + SITTING_HEADROOM_ALLOWANCE_MM,
      )
      if (!judged.anyFails) continue

      findings.push(
        ergonomicFinding({
          id: findingId(RULE_IDS.SITTING_HEADROOM, surface.id),
          ruleId: RULE_IDS.SITTING_HEADROOM,
          ruleName: 'Sitting headroom',
          message: `Sitting headroom over ${surface.name.toLowerCase()}: ${formatLength(
            Math.round(clearance),
            units,
          )}`,
          detail: limitedBy
            ? `${personaSummary(judged, ctx)}. Limited by the ${limitedBy.toLowerCase()}.`
            : personaSummary(judged, ctx),
          objectIds: [surface.id],
          measured: Math.round(clearance),
          threshold: Math.round(judged.worstThreshold),
          judged,
          focus: {
            x: surface.position.x + surface.size.w / 2,
            y: surface.position.y + surface.size.d / 2,
            z: surface.position.z + surface.size.h,
          },
        }),
      )
    }

    return findings
  },
}
