import { RULE_IDS } from '../../constants'
import type { Rule } from '../../definitions'
import { boxOf, intersects3D } from '../../geometry'
import { findingId } from '../engine'
import { formatLength } from '../../units'

/**
 * Two objects occupying the same space.
 *
 * Uses the full 3D test, so an overhead locker above a worktop is fine and only
 * a genuine collision is reported. Loose objects are already excluded from
 * `obstructing` — a crate shoved under the bed is not a build error.
 */
export const objectOverlapRule: Rule = {
  id: RULE_IDS.OBJECT_OVERLAP,
  name: 'Objects overlap',
  description: 'Two fixed objects occupy the same space.',
  severity: 'error',
  layer: 'structure',

  evaluate(ctx) {
    const findings = []
    const objects = ctx.obstructing

    for (let i = 0; i < objects.length; i++) {
      const a = objects[i]!
      const boxA = boxOf(a)

      for (let j = i + 1; j < objects.length; j++) {
        const b = objects[j]!
        const result = intersects3D(boxA, boxOf(b))
        if (!result.intersecting) continue

        findings.push({
          id: findingId(RULE_IDS.OBJECT_OVERLAP, a.id, b.id),
          ruleId: RULE_IDS.OBJECT_OVERLAP,
          ruleName: 'Objects overlap',
          severity: 'error' as const,
          layer: 'structure' as const,
          message: `${a.name} and ${b.name} overlap`,
          detail: `They share ${formatLength(
            Math.round(result.horizontal),
            ctx.settings.unitSystem,
          )} horizontally and ${formatLength(
            Math.round(result.vertical),
            ctx.settings.unitSystem,
          )} vertically. Move one of them, or lower the height of whichever should sit underneath.`,
          objectIds: [a.id, b.id],
          measured: { value: Math.round(result.horizontal), threshold: 0 },
          focus: {
            x: (a.position.x + b.position.x) / 2,
            y: (a.position.y + b.position.y) / 2,
            z: (a.position.z + b.position.z) / 2,
          },
        })
      }
    }

    return findings
  },
}
