import { RULE_IDS } from '../../constants'
import type { Finding, Grams, Rule, SceneContext } from '../../definitions'
import { formatMass } from '../../units'
import { findingId } from '../engine'

/**
 * Weight is cheap to compute from data the model already holds, and overloading
 * is a genuine safety and legal problem that people hit constantly — water,
 * batteries and plywood are the usual culprits (spec section 4).
 *
 * Loose objects count here even though they are exempt from clearance rules: a
 * crate of tools weighs the same whether or not it is bolted down.
 */

export interface LoadSummary {
  total: Grams
  payload: Grams
  frontAxle: Grams
  rearAxle: Grams
  /** Axle capacities are not published per-axle in the seed data, so these are
   * derived from the kerb split plus payload — approximate, and labelled so. */
  frontCapacity: Grams
  rearCapacity: Grams
}

/**
 * Distribute the build across the axles.
 *
 * Each object is a point mass at its centre, and the load splits between the
 * axles in inverse proportion to its distance from each — the standard lever
 * calculation. Something behind the rear axle transfers load off the front,
 * which is exactly how a heavy rear garage makes a van handle badly, so the
 * arithmetic is allowed to go negative rather than being clamped.
 */
export function summariseLoad(ctx: SceneContext): LoadSummary {
  const { van } = ctx
  const wheelbase = van.rearAxleY - van.frontAxleY

  let total = 0
  let frontFromBuild = 0
  let rearFromBuild = 0

  for (const object of ctx.objects) {
    total += object.mass
    if (object.mass === 0) continue

    const centreY = object.position.y + object.size.d / 2

    if (wheelbase <= 0) {
      // Degenerate axle geometry (custom van with no figures entered): split
      // evenly rather than dividing by zero.
      frontFromBuild += object.mass / 2
      rearFromBuild += object.mass / 2
      continue
    }

    const rearShare = (centreY - van.frontAxleY) / wheelbase
    rearFromBuild += object.mass * rearShare
    frontFromBuild += object.mass * (1 - rearShare)
  }

  return {
    total,
    payload: van.payload,
    frontAxle: van.kerbFrontAxle + frontFromBuild,
    rearAxle: van.kerbRearAxle + rearFromBuild,
    // Without published per-axle ratings, apportion the payload the same way the
    // kerb weight already sits. Approximate, and the finding says so.
    frontCapacity: van.kerbFrontAxle + van.payload * 0.4,
    rearCapacity: van.kerbRearAxle + van.payload * 0.6,
  }
}

export const totalPayloadRule: Rule = {
  id: RULE_IDS.TOTAL_PAYLOAD,
  name: 'Total weight',
  description: 'Whether the build fits inside the van payload.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    const load = summariseLoad(ctx)
    if (load.payload <= 0) return []

    const units = ctx.settings.unitSystem
    const remaining = load.payload - load.total

    // Over payload is an error; close to it is a warning, because water, food,
    // gear and passengers still have to fit in what is left.
    const over = load.total > load.payload
    const tight = remaining < load.payload * 0.2

    if (!over && !tight) return []

    const findings: Finding[] = [
      {
        id: findingId(RULE_IDS.TOTAL_PAYLOAD),
        ruleId: RULE_IDS.TOTAL_PAYLOAD,
        ruleName: 'Total weight',
        severity: over ? 'error' : 'warning',
        layer: 'structure',
        message: over
          ? `Build is ${formatMass(load.total - load.payload, units)} over payload`
          : `Only ${formatMass(remaining, units)} of payload left`,
        detail: over
          ? `The build weighs ${formatMass(load.total, units)} against a payload of ${formatMass(
              load.payload,
              units,
            )}. Water, gear and passengers all come out of the same allowance.`
          : `The build weighs ${formatMass(load.total, units)} of ${formatMass(
              load.payload,
              units,
            )}. Full water tanks, gear and passengers still have to fit in what is left.`,
        objectIds: [],
        measured: { value: load.total, threshold: load.payload },
      },
    ]

    return findings
  },
}

export const axleLoadRule: Rule = {
  id: RULE_IDS.AXLE_LOAD,
  name: 'Axle load',
  description: 'Whether weight is distributed sensibly between the axles.',
  severity: 'warning',
  layer: 'structure',

  evaluate(ctx) {
    const load = summariseLoad(ctx)
    if (load.payload <= 0 || load.total === 0) return []

    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    const axles = [
      { name: 'rear', mass: load.rearAxle, capacity: load.rearCapacity },
      { name: 'front', mass: load.frontAxle, capacity: load.frontCapacity },
    ]

    for (const axle of axles) {
      if (axle.mass <= axle.capacity) continue

      findings.push({
        id: findingId(RULE_IDS.AXLE_LOAD, axle.name),
        ruleId: RULE_IDS.AXLE_LOAD,
        ruleName: 'Axle load',
        severity: 'warning',
        layer: 'structure',
        message: `${axle.name === 'rear' ? 'Rear' : 'Front'} axle is carrying ${formatMass(
          axle.mass - axle.capacity,
          units,
        )} too much`,
        detail: `Estimated ${formatMass(axle.mass, units)} on the ${axle.name} axle against roughly ${formatMass(
          axle.capacity,
          units,
        )} of capacity. Axle ratings are not published in the preset data, so this figure is apportioned from the kerb split — treat it as a prompt to weigh the van, not a measurement. Moving heavy items such as water and batteries toward the middle of the wheelbase is the usual fix.`,
        objectIds: heaviestContributors(ctx, axle.name === 'rear'),
        measured: { value: Math.round(axle.mass), threshold: Math.round(axle.capacity) },
      })
    }

    return findings
  },
}

/** The heaviest few objects sitting toward the offending end of the van. */
function heaviestContributors(ctx: SceneContext, rear: boolean): string[] {
  const midpoint = (ctx.van.frontAxleY + ctx.van.rearAxleY) / 2

  return ctx.objects
    .filter((object) => {
      const centreY = object.position.y + object.size.d / 2
      return rear ? centreY > midpoint : centreY < midpoint
    })
    .sort((a, b) => b.mass - a.mass)
    .slice(0, 3)
    .map((object) => object.id)
}
