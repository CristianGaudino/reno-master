import { BED_LENGTH_ALLOWANCE_MM, BODY_RATIOS, RULE_IDS } from '../../constants'
import type { Finding, Rule } from '../../definitions'
import { formatLength } from '../../units'
import { findingId } from '../engine'
import { ergonomicFinding, judge, personaSummary } from './shared'

/**
 * Bed long enough to lie down in.
 *
 * A van bed usually runs across the vehicle to save length, and interior width
 * is the constraint that decides whether that works. The longer of the bed's two
 * horizontal dimensions is the sleeping direction.
 */
export const bedLengthRule: Rule = {
  id: RULE_IDS.BED_LENGTH,
  name: 'Bed length',
  description: 'Whether the bed is long enough to lie out flat.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    for (const bed of ctx.objects.filter((object) => object.category === 'sleeping')) {
      const length = Math.max(bed.size.w, bed.size.d)

      const judged = judge(ctx, length, (height) => height + BED_LENGTH_ALLOWANCE_MM)
      if (!judged.anyFails) continue

      const across = bed.size.w > bed.size.d

      findings.push(
        ergonomicFinding({
          id: findingId(RULE_IDS.BED_LENGTH, bed.id),
          ruleId: RULE_IDS.BED_LENGTH,
          ruleName: 'Bed length',
          message: `${bed.name} is ${formatLength(length, units)} long`,
          detail: `${personaSummary(judged, ctx)}.${
            across
              ? ' It runs across the van, so interior width is what limits it — turning it lengthways would give more room if the layout allows.'
              : ''
          }`,
          objectIds: [bed.id],
          measured: length,
          threshold: Math.round(judged.worstThreshold),
          judged,
          focus: {
            x: bed.position.x + bed.size.w / 2,
            y: bed.position.y + bed.size.d / 2,
            z: bed.position.z + bed.size.h,
          },
        }),
      )
    }

    return findings
  },
}

/**
 * Overhead storage within reach.
 *
 * Checks the height of the shelf itself, not its contents: if the base of a
 * locker is above your comfortable reach you cannot get anything out of it
 * without standing on something.
 */
export const reachHeightRule: Rule = {
  id: RULE_IDS.REACH_HEIGHT,
  name: 'Reach to overhead storage',
  description: 'Whether overhead storage can be reached without climbing.',
  severity: 'warning',
  layer: 'storage',

  evaluate(ctx) {
    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    for (const locker of ctx.objects) {
      if (locker.category !== 'storage' && locker.category !== 'kitchen') continue

      // Only overhead units are candidates; a floor cupboard is not a reach problem.
      const base = locker.position.z
      if (base < 1200) continue

      const usableHeight = base + locker.size.h

      const judged = judge(ctx, usableHeight, (height) => height * BODY_RATIOS.reachHeight)
      if (!judged.anyFails) continue

      findings.push(
        ergonomicFinding({
          id: findingId(RULE_IDS.REACH_HEIGHT, locker.id),
          ruleId: RULE_IDS.REACH_HEIGHT,
          ruleName: 'Reach to overhead storage',
          message: `${locker.name} reaches ${formatLength(usableHeight, units)} up`,
          detail: `${personaSummary(
            judged,
            ctx,
          )}. The top of it is above comfortable reach, so the upper part will be hard to use.`,
          objectIds: [locker.id],
          measured: usableHeight,
          threshold: Math.round(judged.worstThreshold),
          judged,
          focus: {
            x: locker.position.x + locker.size.w / 2,
            y: locker.position.y + locker.size.d / 2,
            z: usableHeight,
          },
        }),
      )
    }

    return findings
  },
}
