/**
 * The rule registry.
 *
 * Adding a check means writing a module and adding one line here. Nothing else
 * in the engine, the UI or the settings screen needs to know about it — the
 * warnings panel and the per-rule toggles are both driven off this array.
 */

import type { Rule } from '../definitions'

import { apertureBlockedRule } from './conflicts/apertureBlocked'
import { objectOverlapRule } from './conflicts/objectOverlap'
import { obstacleIntersectRule } from './conflicts/obstacleIntersect'
import { outOfBoundsRule } from './conflicts/outOfBounds'
import { swingBlockedRule } from './conflicts/swingBlocked'

import { aisleWidthRule, doorEgressRule } from './ergonomics/circulation'
import { sittingHeadroomRule, standingHeadroomRule } from './ergonomics/headroom'
import { bedLengthRule, reachHeightRule } from './ergonomics/reach'

import { axleLoadRule, totalPayloadRule } from './weight/load'
import { dcRunLengthRule, waterRunLengthRule } from './systems/runs'

/** Objectively wrong: the build cannot be made as drawn. */
export const HARD_CONFLICT_RULES: Rule[] = [
  objectOverlapRule,
  outOfBoundsRule,
  obstacleIntersectRule,
  swingBlockedRule,
  apertureBlockedRule,
]

/** Depends on the person, so these report against more than one body. */
export const ERGONOMIC_RULES: Rule[] = [
  standingHeadroomRule,
  sittingHeadroomRule,
  aisleWidthRule,
  bedLengthRule,
  reachHeightRule,
  doorEgressRule,
]

export const WEIGHT_RULES: Rule[] = [totalPayloadRule, axleLoadRule]

/**
 * Systems (spec section 7). Deliberately light: run lengths, not schematics.
 * These belong to the electrical and plumbing layers, so they stay out of the
 * way while someone is arranging furniture.
 */
export const SYSTEM_RULES: Rule[] = [dcRunLengthRule, waterRunLengthRule]

export const ALL_RULES: Rule[] = [
  ...HARD_CONFLICT_RULES,
  ...ERGONOMIC_RULES,
  ...WEIGHT_RULES,
  ...SYSTEM_RULES,
]

/** Grouped for the settings screen, where the headings match the spec's own. */
export const RULE_GROUPS = [
  { title: 'Hard conflicts', description: 'Objectively wrong — the build will not go together.', rules: HARD_CONFLICT_RULES },
  { title: 'Ergonomics', description: 'Depends on who is using the van.', rules: ERGONOMIC_RULES },
  { title: 'Weight', description: 'Payload and axle distribution.', rules: WEIGHT_RULES },
  {
    title: 'Systems',
    description: 'Cable and pipe run lengths, on the electrical and plumbing layers.',
    rules: SYSTEM_RULES,
  },
] as const

export function ruleById(id: string): Rule | undefined {
  return ALL_RULES.find((rule) => rule.id === id)
}
