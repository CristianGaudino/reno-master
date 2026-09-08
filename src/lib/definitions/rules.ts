import type { Mm, ResolvedVan, UserSettings, VanObject } from './domain'

/**
 * `error` means objectively wrong — the build cannot be made as drawn.
 * `warning` means it depends on the person, the use case, or tolerance.
 */
export type Severity = 'error' | 'warning'

/**
 * Which overlay a finding belongs to. Spec section 1: warnings belong to a
 * layer, so a cable-run warning surfaces in the electrical view rather than
 * while the user is placing a bed.
 *
 * Layers themselves are build-order step 9 and not yet built; tagging findings
 * now means switching them on later is a filter, not a refactor.
 */
export type RuleLayer = 'structure' | 'electrical' | 'plumbing' | 'storage'

/** Which body the ergonomic measurement was taken against. */
export type Persona = 'standard' | 'user'

/**
 * One measurement of an ergonomic rule against one body. Ergonomic rules always
 * report the 6'0" standard as well as the user's own height (spec section 4) —
 * the designer is not the only person who will ever use the van.
 */
export interface PersonaResult {
  persona: Persona
  /** Height of the body this was measured against. */
  heightMm: Mm
  passes: boolean
  /** Human-readable verdict fragment, e.g. "tight for someone 6'0"". */
  note: string
}

export interface Finding {
  /** Stable within a single evaluation; used as a React key. */
  id: string
  ruleId: string
  ruleName: string
  severity: Severity
  layer: RuleLayer
  /** One-line summary shown in the warnings panel. */
  message: string
  /** Optional longer explanation, shown when the finding is expanded. */
  detail?: string
  /** Objects to highlight in the canvas when this finding is selected. */
  objectIds: string[]
  /** Measured value and the threshold it was compared against, both in mm. */
  measured?: { value: Mm; threshold: Mm }
  /** Populated by ergonomic rules that evaluate against more than one body. */
  personas?: PersonaResult[]
  /**
   * Where to point the camera when the user clicks the finding. Absent for
   * findings that are not spatially located (e.g. total payload).
   */
  focus?: { x: Mm; y: Mm; z: Mm }
}

/** Everything a rule is allowed to look at. Rules are pure functions of this. */
export interface SceneContext {
  van: ResolvedVan
  objects: VanObject[]
  settings: UserSettings
  /**
   * Objects excluding `loose` ones — the set that clearance and circulation
   * rules operate on (spec section 2).
   */
  obstructing: VanObject[]
}

/**
 * A rule is a separate named check, not a branch inside one validation pass, so
 * that adding a rule touches no existing rule (spec section 4). Every rule is
 * individually toggleable via `UserSettings.disabledRules`.
 */
export interface Rule {
  id: string
  name: string
  /** Shown in settings so the user knows what they are switching off. */
  description: string
  severity: Severity
  layer: RuleLayer
  /** Rules default to on; a few opinionated ones can default to off. */
  defaultEnabled?: boolean
  evaluate(ctx: SceneContext): Finding[]
}

export interface RuleReport {
  findings: Finding[]
  errorCount: number
  warningCount: number
  /** Ids of rules that were skipped because the user disabled them. */
  skipped: string[]
}
