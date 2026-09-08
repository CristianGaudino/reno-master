import { CONTACT_TOLERANCE_MM, RULE_IDS } from '../../constants'
import type { Finding, Rule } from '../../definitions'
import { boxExtent, boxOf, narrowestXRangeBetween } from '../../geometry'
import { formatLength } from '../../units'
import { findingId } from '../engine'

const SIDE_LABELS: Record<string, string> = {
  left: 'the left wall',
  right: 'the right wall',
  front: 'the bulkhead',
  back: 'the rear doors',
  floor: 'the floor',
  roof: 'the roof',
}

/**
 * Object extends beyond the van interior.
 *
 * Width is checked against the taper profile across the object's own height
 * band, not against the nominal maximum width. A van is not a box: a cabinet
 * that sits happily against the wall at floor level can foul it at shoulder
 * height, and checking only the widest point would miss exactly the case that
 * bites people when they come to fit it.
 */
export const outOfBoundsRule: Rule = {
  id: RULE_IDS.OUT_OF_BOUNDS,
  name: 'Outside the van',
  description: 'An object extends past the interior walls, floor or roof.',
  severity: 'error',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []
    const { interior, taper } = ctx.van
    const units = ctx.settings.unitSystem

    for (const object of ctx.objects) {
      const box = boxOf(object)
      const zMin = object.position.z
      const zMax = zMin + object.size.h

      // Width available across the height this object actually spans.
      const walls = narrowestXRangeBetween(zMin, zMax, interior.w, taper)

      const extent = boxExtent(box)
      const breaches: Array<{ side: string; amount: number }> = []

      const record = (side: string, amount: number) => {
        if (amount > CONTACT_TOLERANCE_MM) breaches.push({ side, amount })
      }

      record('left', walls.min - extent.minX)
      record('right', extent.maxX - walls.max)
      record('front', -extent.minY)
      record('back', extent.maxY - interior.d)
      record('floor', -zMin)
      record('roof', zMax - interior.h)

      if (breaches.length === 0) continue

      breaches.sort((a, b) => b.amount - a.amount)
      const worst = breaches[0]!

      const taperedAtHeight = walls.min > CONTACT_TOLERANCE_MM || walls.max < interior.w - CONTACT_TOLERANCE_MM
      const taperNote =
        taperedAtHeight && (worst.side === 'left' || worst.side === 'right')
          ? ` The walls lean in above the floor, so the usable width across this object's height is ${formatLength(
              Math.round(walls.max - walls.min),
              units,
            )} rather than the full ${formatLength(interior.w, units)}.`
          : ''

      findings.push({
        id: findingId(RULE_IDS.OUT_OF_BOUNDS, object.id),
        ruleId: RULE_IDS.OUT_OF_BOUNDS,
        ruleName: 'Outside the van',
        severity: 'error',
        layer: 'structure',
        message: `${object.name} extends past ${SIDE_LABELS[worst.side] ?? worst.side} by ${formatLength(
          Math.round(worst.amount),
          units,
        )}`,
        detail:
          breaches.length > 1
            ? `Also past ${breaches
                .slice(1)
                .map((breach) => SIDE_LABELS[breach.side] ?? breach.side)
                .join(' and ')}.${taperNote}`
            : taperNote || undefined,
        objectIds: [object.id],
        measured: { value: Math.round(worst.amount), threshold: 0 },
        focus: { ...object.position },
      })
    }

    return findings
  },
}
