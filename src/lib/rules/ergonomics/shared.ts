/**
 * Helpers shared by the ergonomic rules.
 *
 * The common shape of these rules: measure something once, then judge it against
 * every body in `personasFor`. Spec section 4 requires warnings to report the
 * 6'0" standard alongside the user's own height, so the judging is separated
 * from the measuring and the same measurement gets both verdicts.
 */

import type {
  Finding,
  Mm,
  PersonaResult,
  RuleLayer,
  Severity,
  SceneContext,
  VanObject,
} from '../../definitions'
import { footprintContainsPoint, footprintFrom } from '../../geometry'
import { formatLength } from '../../units'
import { personasFor, type PersonaSpec } from '../engine'

/** Height a person can stand under without stooping, per persona. */
export interface Judged {
  personas: PersonaResult[]
  /** True when at least one body fails; that is what raises the warning. */
  anyFails: boolean
  /** The tightest requirement across the bodies, for sorting by severity. */
  worstThreshold: Mm
}

/**
 * Judge one measurement against every persona.
 *
 * `requirementFor` turns a stature into the clearance that body needs.
 */
export function judge(
  ctx: SceneContext,
  measured: Mm,
  requirementFor: (heightMm: Mm) => Mm,
): Judged {
  const specs = personasFor(ctx.settings)
  const personas: PersonaResult[] = specs.map((spec) => {
    const required = requirementFor(spec.heightMm)
    const passes = measured >= required
    return {
      persona: spec.persona,
      heightMm: spec.heightMm,
      passes,
      note: describe(spec, passes, measured, required, ctx),
    }
  })

  return {
    personas,
    anyFails: personas.some((persona) => !persona.passes),
    worstThreshold: Math.max(...specs.map((spec) => requirementFor(spec.heightMm))),
  }
}

function describe(
  spec: PersonaSpec,
  passes: boolean,
  measured: Mm,
  required: Mm,
  ctx: SceneContext,
): string {
  const units = ctx.settings.unitSystem
  if (passes) return `fits ${spec.label}`
  const shortfall = formatLength(Math.round(required - measured), units, { inchesOnly: true })
  return `${shortfall} short for ${spec.label}`
}

/**
 * Render the persona verdicts as the spec's two-part message, e.g.
 * "Tight for someone 6′0″ · fits you at 5′8″".
 */
export function personaSummary(
  judged: Judged,
  ctx: SceneContext,
): string {
  return judged.personas
    .map((persona) => {
      const stature = formatLength(persona.heightMm, ctx.settings.unitSystem)
      const who = persona.persona === 'user' ? `you at ${stature}` : `someone ${stature}`
      return persona.passes ? `fits ${who}` : `tight for ${who}`
    })
    .join(' · ')
}

// ---------------------------------------------------------------------------
// Floor sampling
// ---------------------------------------------------------------------------

/** Resolution of the floor scan used by the standing-headroom rule. */
const FLOOR_SAMPLE_STEP_MM = 100

/** Height below which an object stops you standing on that patch of floor. */
const FOOT_BLOCK_HEIGHT_MM = 300

/** Height above which an object counts as something you would hit your head on. */
const OVERHEAD_THRESHOLD_MM = 1200

export interface StandingSpot {
  x: Mm
  y: Mm
  /** Clear height from the floor at this spot. */
  clearHeight: Mm
  /** What is limiting it, if anything. */
  limitedBy: string | null
}

/**
 * The lowest standing headroom anywhere a person could actually stand.
 *
 * Floor patches occupied by furniture are skipped — you cannot stand inside a
 * cabinet, so the clearance above it is irrelevant. What is left is the space
 * someone walks and works in, which is what the warning is really about.
 */
export function lowestStandingSpot(ctx: SceneContext): StandingSpot | null {
  const { interior } = ctx.van
  const objects = ctx.obstructing

  const footprints = objects.map((object) => ({
    object,
    footprint: footprintFrom(object.position, object.size, object.yaw),
    zMin: object.position.z,
    zMax: object.position.z + object.size.h,
  }))

  let worst: StandingSpot | null = null

  for (let x = FLOOR_SAMPLE_STEP_MM / 2; x < interior.w; x += FLOOR_SAMPLE_STEP_MM) {
    for (let y = FLOOR_SAMPLE_STEP_MM / 2; y < interior.d; y += FLOOR_SAMPLE_STEP_MM) {
      const point = { x, y }

      let standable = true
      let clearHeight = interior.h
      let limitedBy: string | null = null

      for (const entry of footprints) {
        if (!footprintContainsPoint(entry.footprint, point)) continue

        // Something at foot level means you are not standing here.
        if (entry.zMin < FOOT_BLOCK_HEIGHT_MM) {
          standable = false
          break
        }

        // Otherwise it is overhead, and its underside is the ceiling here.
        if (entry.zMin >= OVERHEAD_THRESHOLD_MM && entry.zMin < clearHeight) {
          clearHeight = entry.zMin
          limitedBy = entry.object.name
        }
      }

      if (!standable) continue

      if (!worst || clearHeight < worst.clearHeight) {
        worst = { x, y, clearHeight, limitedBy }
      }
    }
  }

  return worst
}

/**
 * Vertical clear space directly above an object's top surface.
 *
 * Used for sitting headroom over a bed or a bench: what stops you sitting up is
 * whatever hangs over the mattress, or the roof.
 */
export function clearanceAbove(ctx: SceneContext, subject: VanObject): {
  clearance: Mm
  limitedBy: string | null
} {
  const top = subject.position.z + subject.size.h
  const subjectFootprint = footprintFrom(subject.position, subject.size, subject.yaw)

  let ceiling = ctx.van.interior.h
  let limitedBy: string | null = null

  for (const object of ctx.obstructing) {
    if (object.id === subject.id) continue

    const zMin = object.position.z
    if (zMin < top) continue

    const footprint = footprintFrom(object.position, object.size, object.yaw)
    if (!footprintsShareArea(subjectFootprint, footprint)) continue

    if (zMin < ceiling) {
      ceiling = zMin
      limitedBy = object.name
    }
  }

  return { clearance: ceiling - top, limitedBy }
}

function footprintsShareArea(
  a: ReturnType<typeof footprintFrom>,
  b: ReturnType<typeof footprintFrom>,
): boolean {
  // A cheap centre-point test in both directions is enough here: we only need to
  // know whether one sits meaningfully over the other, not the exact area.
  return (
    footprintContainsPoint(a, { x: b.cx, y: b.cy }) ||
    footprintContainsPoint(b, { x: a.cx, y: a.cy })
  )
}

// ---------------------------------------------------------------------------
// Finding construction
// ---------------------------------------------------------------------------

export function ergonomicFinding(options: {
  id: string
  ruleId: string
  ruleName: string
  layer?: RuleLayer
  severity?: Severity
  message: string
  detail?: string
  objectIds: string[]
  measured: Mm
  threshold: Mm
  judged: Judged
  focus?: { x: Mm; y: Mm; z: Mm }
}): Finding {
  const finding: Finding = {
    id: options.id,
    ruleId: options.ruleId,
    ruleName: options.ruleName,
    severity: options.severity ?? 'warning',
    layer: options.layer ?? 'structure',
    message: options.message,
    objectIds: options.objectIds,
    measured: { value: options.measured, threshold: options.threshold },
    personas: options.judged.personas,
  }

  if (options.detail !== undefined) finding.detail = options.detail
  if (options.focus !== undefined) finding.focus = options.focus

  return finding
}
