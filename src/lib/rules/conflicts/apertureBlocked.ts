import { RULE_IDS } from '../../constants'
import type { Finding, Rule } from '../../definitions'
import { boxOf, evaluateSwing, intersects3D, type SwingCandidate } from '../../geometry'
import { formatLength } from '../../units'
import { findingId } from '../engine'

/**
 * Object blocks a door aperture, or blocks the van's own doors from opening.
 *
 * Two distinct failures share this rule because they are the same mistake to the
 * user: something is in the way of getting in or out.
 *
 * 1. An object standing in the doorway itself.
 * 2. An object inside the van fouling the swept path of the sliding or rear
 *    doors, which are articulated obstacles carried on the van model.
 */
export const apertureBlockedRule: Rule = {
  id: RULE_IDS.APERTURE_BLOCKED,
  name: 'Doorway blocked',
  description: 'An object stands in a door aperture or stops the van doors opening.',
  severity: 'error',
  layer: 'structure',

  evaluate(ctx) {
    const findings: Finding[] = []
    const apertures = ctx.van.obstacles.filter(
      (obstacle) => obstacle.kind === 'aperture_side' || obstacle.kind === 'aperture_rear',
    )
    if (apertures.length === 0) return findings

    const units = ctx.settings.unitSystem

    for (const aperture of apertures) {
      const apertureBox = boxOf(aperture)

      // 1. Anything standing in the opening.
      for (const object of ctx.obstructing) {
        const result = intersects3D(boxOf(object), apertureBox)
        if (!result.intersecting) continue

        findings.push({
          id: findingId(RULE_IDS.APERTURE_BLOCKED, aperture.id, object.id),
          ruleId: RULE_IDS.APERTURE_BLOCKED,
          ruleName: 'Doorway blocked',
          severity: 'error',
          layer: 'structure',
          message: `${object.name} blocks the ${aperture.name.toLowerCase()}`,
          detail: `It stands ${formatLength(
            Math.round(result.horizontal),
            units,
          )} into the opening. You need this clear to get in and out, and to meet the door.`,
          objectIds: [object.id],
          measured: { value: Math.round(result.horizontal), threshold: 0 },
          focus: { ...aperture.position },
        })
      }

      // 2. The van's own door leaf fouling something inside.
      if (!aperture.articulation) continue

      const candidates: SwingCandidate[] = ctx.obstructing.map((object) => ({
        id: object.id,
        name: object.name,
        box: boxOf(object),
      }))

      const swing = evaluateSwing(aperture.articulation, candidates)
      if (!swing.blocked) continue

      const first = swing.blockers[0]!
      findings.push({
        id: findingId(RULE_IDS.APERTURE_BLOCKED, aperture.id, 'swing'),
        ruleId: RULE_IDS.APERTURE_BLOCKED,
        ruleName: 'Doorway blocked',
        severity: 'error',
        layer: 'structure',
        message: `The ${aperture.name.toLowerCase()} fouls ${first.name}`,
        detail: `The door reaches about ${swing.maxOpenAngle}° of ${Math.round(
          swing.requestedAngle,
        )}° before it hits ${swing.blockers.map((blocker) => blocker.name).join(', ')}.`,
        objectIds: swing.blockers.map((blocker) => blocker.id),
        measured: { value: swing.maxOpenAngle, threshold: Math.round(swing.requestedAngle) },
        focus: { ...aperture.position },
      })
    }

    return findings
  },
}
