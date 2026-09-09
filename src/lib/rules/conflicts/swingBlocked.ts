import { RULE_IDS } from '../../constants'
import type { Finding, Rule, SceneContext } from '../../definitions'
import { boxOf, evaluateSwing, type SwingCandidate } from '../../geometry'
import { findingId } from '../engine'

/**
 * Articulated object's swing arc is blocked.
 *
 * Spec section 2 calls this the highest-value check in the app, and it is the
 * one people most often discover with a tape measure after the cabinet is
 * screwed down. The sweep is sampled through its travel rather than approximated
 * by a bounding circle, so the finding can name the angle at which the door
 * actually fouls — "opens to 50° of 90°" is something you can act on, where
 * "blocked" is not.
 */
export const swingBlockedRule: Rule = {
  id: RULE_IDS.SWING_BLOCKED,
  name: 'Door or panel cannot open',
  description:
    'An articulated object is obstructed part-way through its swing.',
  severity: 'error',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []

    // Built once rather than per articulated object: a van with a dozen doors
    // was constructing every other object's bounding box a dozen times over.
    const allCandidates = allSwingCandidates(ctx)

    for (const object of ctx.objects) {
      if (object.kind !== 'articulated' || !object.articulation) continue

      const candidates = allCandidates.filter((candidate) => candidate.id !== object.id)
      const result = evaluateSwing(object.articulation, candidates)
      if (!result.blocked) continue

      const blockerNames = result.blockers.map((blocker) => blocker.name)
      const first = result.blockers[0]!

      findings.push({
        id: findingId(RULE_IDS.SWING_BLOCKED, object.id),
        ruleId: RULE_IDS.SWING_BLOCKED,
        ruleName: 'Door or panel cannot open',
        severity: 'error',
        layer: 'structure',
        message:
          first.angle === 0
            ? `${object.name} cannot open at all — ${first.name} is hard against it`
            : `${object.name} fouls ${first.name} at ${first.angle}° of ${Math.round(
                result.requestedAngle,
              )}°`,
        detail:
          blockerNames.length > 1
            ? `Opens to about ${result.maxOpenAngle}° before hitting ${blockerNames.join(', ')}.`
            : `Opens to about ${result.maxOpenAngle}° before it stops.`,
        objectIds: [object.id, ...result.blockers.map((blocker) => blocker.id)],
        measured: {
          value: result.maxOpenAngle,
          threshold: Math.round(result.requestedAngle),
        },
        focus: {
          x: object.articulation.hinge.x,
          y: object.articulation.hinge.y,
          z: object.articulation.zRange.min,
        },
      })
    }

    return findings
  },
}

/**
 * Everything a swing could collide with.
 *
 * Loose items are excluded — they can be moved out of the way before opening a
 * door — as are apertures, which are voids rather than obstructions. The
 * object's own body is filtered out per swing by the caller: a fridge door
 * hinged on the fridge is not blocked by the fridge.
 */
function allSwingCandidates(ctx: SceneContext): SwingCandidate[] {
  const candidates: SwingCandidate[] = []

  for (const object of ctx.obstructing) {
    candidates.push({ id: object.id, name: object.name, box: boxOf(object) })
  }

  for (const obstacle of ctx.van.obstacles) {
    if (obstacle.kind === 'aperture_side' || obstacle.kind === 'aperture_rear') continue
    if (obstacle.kind === 'mount_point') continue
    candidates.push({ id: obstacle.id, name: obstacle.name, box: boxOf(obstacle) })
  }

  return candidates
}
