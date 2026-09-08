import {
  MAX_DC_RUN_MM,
  MAX_PUMP_RUN_MM,
  MAX_WATER_RUN_MM,
  RULE_IDS,
} from '../../constants'
import type { Finding, Rule } from '../../definitions'
import { inferRuns } from '../../systems'
import { formatLength } from '../../units'
import { findingId } from '../engine'

/**
 * Excessive DC cable runs.
 *
 * Long 12V runs are the quiet failure in a van build: nothing breaks, the fridge
 * just never quite gets there and the cable warms up. Voltage drop scales with
 * length and current, so distance is the thing worth flagging early — while the
 * battery can still be moved.
 *
 * This surfaces on the electrical layer, so it does not interrupt someone who is
 * placing a bed (spec section 1).
 */
export const dcRunLengthRule: Rule = {
  id: RULE_IDS.DC_RUN_LENGTH,
  name: 'DC cable runs',
  description: 'Whether anything is a long way from the battery.',
  severity: 'warning',
  layer: 'electrical',

  evaluate(ctx) {
    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    for (const run of inferRuns(ctx.objects)) {
      if (run.system !== 'dc') continue
      if (run.length <= MAX_DC_RUN_MM) continue

      findings.push({
        id: findingId(RULE_IDS.DC_RUN_LENGTH, run.id),
        ruleId: RULE_IDS.DC_RUN_LENGTH,
        ruleName: 'DC cable runs',
        severity: 'warning',
        layer: 'electrical',
        message: `${run.label}: ${formatLength(Math.round(run.length), units)} of cable`,
        detail: `Measured as a right-angled route, which is how cable actually runs. Past about ${formatLength(
          MAX_DC_RUN_MM,
          units,
        )} you are into heavier cable to keep voltage drop sensible — moving the battery closer is usually cheaper than the copper.`,
        objectIds: [run.from.id, run.to.id],
        measured: { value: Math.round(run.length), threshold: MAX_DC_RUN_MM },
        focus: {
          x: (run.from.position.x + run.to.position.x) / 2,
          y: (run.from.position.y + run.to.position.y) / 2,
          z: (run.from.position.z + run.to.position.z) / 2,
        },
      })
    }

    return findings
  },
}

/**
 * Awkward plumbing routes.
 *
 * Pipe run matters less than cable, but a pump a long way from its tank loses
 * prime and makes noise where you least want it, so that gets a tighter
 * threshold than the outlets do.
 */
export const waterRunLengthRule: Rule = {
  id: RULE_IDS.WATER_RUN_LENGTH,
  name: 'Water runs',
  description: 'Whether tanks, pump and outlets are sensibly close together.',
  severity: 'warning',
  layer: 'plumbing',

  evaluate(ctx) {
    const findings: Finding[] = []
    const units = ctx.settings.unitSystem

    for (const run of inferRuns(ctx.objects)) {
      if (run.system !== 'water') continue

      const isPumpFeed = /pump/i.test(run.to.name) || /pump/i.test(run.from.name)
      const threshold = isPumpFeed ? MAX_PUMP_RUN_MM : MAX_WATER_RUN_MM
      if (run.length <= threshold) continue

      findings.push({
        id: findingId(RULE_IDS.WATER_RUN_LENGTH, run.id),
        ruleId: RULE_IDS.WATER_RUN_LENGTH,
        ruleName: 'Water runs',
        severity: 'warning',
        layer: 'plumbing',
        message: `${run.label}: ${formatLength(Math.round(run.length), units)} of pipe`,
        detail: isPumpFeed
          ? `A pump this far from its tank is slower to prime and easier to hear. Keeping it within about ${formatLength(
              MAX_PUMP_RUN_MM,
              units,
            )} of the tank is worth planning for.`
          : `Long runs mean more water sitting in the pipe going cold, and more to drain down before a freeze.`,
        objectIds: [run.from.id, run.to.id],
        measured: { value: Math.round(run.length), threshold },
        focus: {
          x: (run.from.position.x + run.to.position.x) / 2,
          y: (run.from.position.y + run.to.position.y) / 2,
          z: (run.from.position.z + run.to.position.z) / 2,
        },
      })
    }

    return findings
  },
}
