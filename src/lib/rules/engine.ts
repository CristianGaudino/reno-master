/**
 * Rule runner.
 *
 * Rules are separate named checks rather than branches in one validation pass,
 * so adding a rule touches no existing rule (spec section 4). This file only
 * decides which rules to run and collects what they say.
 *
 * Runs on the client, on every edit. That is deliberate: warnings have to appear
 * as the user drags, and a network round trip per pointer move is exactly what
 * the spec rules out.
 */

import { STANDARD_HEIGHT_MM } from '../constants'
import type {
  Finding,
  Persona,
  Rule,
  RuleReport,
  SceneContext,
  UserSettings,
  ResolvedVan,
  VanObject,
} from '../definitions'

/**
 * Build the context rules see.
 *
 * `obstructing` excludes loose objects once, here, so no individual rule has to
 * remember to. Spec section 2: a beanbag does not trigger clearance or
 * circulation warnings, though it still counts toward weight.
 */
export function buildContext(
  van: ResolvedVan,
  objects: VanObject[],
  settings: UserSettings,
): SceneContext {
  return {
    van,
    objects,
    settings,
    obstructing: objects.filter((object) => object.kind !== 'loose'),
  }
}

export function evaluateScene(ctx: SceneContext, rules: Rule[]): RuleReport {
  const findings: Finding[] = []
  const skipped: string[] = []

  for (const rule of rules) {
    if (ctx.settings.disabledRules.includes(rule.id)) {
      skipped.push(rule.id)
      continue
    }

    try {
      findings.push(...rule.evaluate(ctx))
    } catch (error) {
      // One rule throwing must not blank the whole warnings panel — the other
      // checks are still valid and the user still needs to see them.
      console.error(`Rule "${rule.id}" failed to evaluate`, error)
    }
  }

  // Errors first, then warnings; within each, the worst breach first, so the
  // top of the panel is always the most useful thing to look at.
  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    const aBreach = breachOf(a)
    const bBreach = breachOf(b)
    return bBreach - aBreach
  })

  return {
    findings,
    errorCount: findings.filter((finding) => finding.severity === 'error').length,
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    skipped,
  }
}

function breachOf(finding: Finding): number {
  if (!finding.measured) return 0
  return Math.abs(finding.measured.threshold - finding.measured.value)
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export interface PersonaSpec {
  persona: Persona
  heightMm: number
  label: string
}

/**
 * The bodies ergonomic rules measure against.
 *
 * The 6'0" standard is always included, whatever the user's own height — spec
 * section 4 is explicit that the designer is not the only person who will ever
 * use the van. The user's height is added only when it differs meaningfully, so
 * a 6'0" user does not see the same number reported twice.
 */
export function personasFor(settings: UserSettings): PersonaSpec[] {
  const specs: PersonaSpec[] = [
    { persona: 'standard', heightMm: STANDARD_HEIGHT_MM, label: 'someone 6′0"' },
  ]

  if (settings.heightMm && Math.abs(settings.heightMm - STANDARD_HEIGHT_MM) > 20) {
    specs.push({ persona: 'user', heightMm: settings.heightMm, label: 'you' })
  }

  return specs
}

/** Stable id for a finding, so React keys survive a re-evaluation. */
export function findingId(ruleId: string, ...parts: string[]): string {
  return [ruleId, ...parts].join(':')
}
