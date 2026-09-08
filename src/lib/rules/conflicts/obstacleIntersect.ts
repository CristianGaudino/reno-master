import { RULE_IDS } from '../../constants'
import type { Finding, ObstacleKind, Rule } from '../../definitions'
import { boxOf, intersects3D } from '../../geometry'
import { formatLength } from '../../units'
import { findingId } from '../engine'

/**
 * Obstacles that physically occupy space and cannot be built through.
 *
 * Door apertures are excluded here: they are voids, not solids, and blocking one
 * is a different problem handled by its own rule with its own message.
 */
const SOLID_OBSTACLES: ObstacleKind[] = ['wheel_well', 'b_pillar', 'intrusion']

/**
 * Object intersects a fixed obstacle.
 *
 * These are the constraints that break real layouts and cannot be moved. Wheel
 * wells in particular are where a "just make the bed 50mm wider" plan dies.
 */
export const obstacleIntersectRule: Rule = {
  id: RULE_IDS.OBSTACLE_INTERSECT,
  name: 'Hits a fixed obstacle',
  description:
    'An object intersects a wheel well, pillar or other structure that cannot be moved.',
  severity: 'error',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []
    const obstacles = ctx.van.obstacles.filter((obstacle) =>
      SOLID_OBSTACLES.includes(obstacle.kind),
    )
    if (obstacles.length === 0) return findings

    for (const object of ctx.obstructing) {
      const box = boxOf(object)

      for (const obstacle of obstacles) {
        const result = intersects3D(box, boxOf(obstacle))
        if (!result.intersecting) continue

        findings.push({
          id: findingId(RULE_IDS.OBSTACLE_INTERSECT, object.id, obstacle.id),
          ruleId: RULE_IDS.OBSTACLE_INTERSECT,
          ruleName: 'Hits a fixed obstacle',
          severity: 'error',
          layer: 'structure',
          message: `${object.name} intersects the ${obstacle.name.toLowerCase()}`,
          detail: `Overlapping by ${formatLength(
            Math.round(result.horizontal),
            ctx.settings.unitSystem,
          )}. This is part of the vehicle and cannot be moved — the object has to go around it, or sit above it.`,
          objectIds: [object.id],
          measured: { value: Math.round(result.horizontal), threshold: 0 },
          focus: { ...obstacle.position },
        })
      }
    }

    return findings
  },
}
