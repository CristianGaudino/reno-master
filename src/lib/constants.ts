/**
 * Domain invariants: things that are true by definition and do not change.
 *
 * Anything you might reasonably want to tune, or that comes from the
 * environment, belongs in `config.ts` instead.
 */

import type { Mm, ObjectCategory, RuleLayer } from './definitions'

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

export const MM_PER_INCH = 25.4
export const MM_PER_FOOT = 304.8
export const GRAMS_PER_POUND = 453.59237
export const GRAMS_PER_KILOGRAM = 1000

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

/**
 * 6'0" exactly. Every ergonomic rule reports against this regardless of the
 * user's own height — spec section 4: the designer is not the only person who
 * will ever use the van.
 */
export const STANDARD_HEIGHT_MM: Mm = 1829

/**
 * Anthropometric ratios used to derive clearances from a stature. These are
 * conventional design-guide proportions, not measurements of any individual;
 * they are good enough to catch a layout that is obviously wrong, which is what
 * the warnings are for.
 */
export const BODY_RATIOS = {
  /** Eye-to-floor when standing; unused by v1 rules but needed for sightlines later. */
  eyeHeight: 0.936,
  /** Shoulder height standing — sets the band the aisle is measured across. */
  shoulderHeight: 0.818,
  /** Seated height from the seat surface to the top of the head. */
  sittingHeight: 0.52,
  /** Comfortable overhead reach with a flat hand. */
  reachHeight: 1.28,
  /** Shoulder breadth, used as the minimum body width for circulation. */
  shoulderBreadth: 0.259,
} as const

/** Clearance a body needs above its stature to stand without stooping. */
export const STANDING_HEADROOM_ALLOWANCE_MM: Mm = 25

/** Sitting headroom is measured from the seat/mattress surface upward. */
export const SITTING_HEADROOM_ALLOWANCE_MM: Mm = 50

/** A bed should exceed stature by this much to be comfortable. */
export const BED_LENGTH_ALLOWANCE_MM: Mm = 100

/** Absolute floor for a usable walkway, below which nobody gets through. */
export const MIN_AISLE_WIDTH_MM: Mm = 350

/** Comfortable walkway width, used as the warning threshold. */
export const COMFORTABLE_AISLE_WIDTH_MM: Mm = 450

/** Clear space needed in front of a door to open it and step past. */
export const DOOR_EGRESS_CLEARANCE_MM: Mm = 600

/** Height band a standing body actually occupies when walking through the van. */
export const CIRCULATION_Z_BAND = { min: 200, max: 1500 } as const

/** Work-surface height where standing headroom is assessed. */
export const GALLEY_WORKTOP_HEIGHT_MM: Mm = 900

// ---------------------------------------------------------------------------
// Geometry tolerances
// ---------------------------------------------------------------------------

/**
 * Overlaps below this are treated as touching rather than colliding. Objects
 * placed flush against each other are the normal case in a van build and must
 * not raise a conflict.
 */
export const CONTACT_TOLERANCE_MM: Mm = 1

/** Angular resolution of the swing-arc sweep. Finer catches tighter fouls. */
export const SWING_SAMPLE_STEP_DEG = 5

/** Longitudinal resolution of the aisle-width scan. */
export const CORRIDOR_SCAN_STEP_MM: Mm = 25

// ---------------------------------------------------------------------------
// Systems (spec section 7 — light, enough to catch the obvious mistakes)
// ---------------------------------------------------------------------------

/**
 * DC run length past which voltage drop starts dictating cable size.
 *
 * A rule of thumb rather than a calculation: proper sizing needs the current
 * draw, which the catalog does not carry. Long enough to be worth moving the
 * battery, short enough not to nag about a light.
 */
export const MAX_DC_RUN_MM: Mm = 5000

/** Fresh tank to pump. Kept tight: a distant pump is slow to prime and noisy. */
export const MAX_PUMP_RUN_MM: Mm = 2000

/** Pump or tank to an outlet. */
export const MAX_WATER_RUN_MM: Mm = 4500

// ---------------------------------------------------------------------------
// Catalog and display
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  sleeping: 'Sleeping',
  kitchen: 'Kitchen',
  seating: 'Seating',
  storage: 'Storage',
  utility: 'Utility',
  electrical: 'Electrical',
  water: 'Water',
}

/**
 * Category colours. Deliberately muted: the canvas needs to stay readable with
 * twenty objects on it, and warnings use saturated red/amber on top of these.
 */
export const CATEGORY_COLORS: Record<ObjectCategory, string> = {
  sleeping: '#7c9cbf',
  kitchen: '#c98a5e',
  seating: '#8fae8b',
  storage: '#a897c4',
  utility: '#9aa3ad',
  electrical: '#d4a94e',
  water: '#6ba8b5',
}

/**
 * Which layer an object belongs to, derived from its category.
 *
 * Spec section 1: layers keep the top-down view legible as systems get added,
 * and a warning belongs to a layer so a cable-run note surfaces in the
 * electrical view rather than while the user is placing a bed.
 *
 * Derived rather than stored: an object's category already says what it is, and
 * a second field to keep in sync would only ever disagree with the first.
 */
export const CATEGORY_LAYER: Record<ObjectCategory, RuleLayer> = {
  sleeping: 'structure',
  kitchen: 'structure',
  seating: 'structure',
  utility: 'structure',
  storage: 'storage',
  electrical: 'electrical',
  water: 'plumbing',
}

export const ALL_LAYERS: RuleLayer[] = ['structure', 'storage', 'electrical', 'plumbing']

export const LAYER_LABELS: Record<RuleLayer, string> = {
  structure: 'Structure',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  storage: 'Storage',
}

export const LAYER_DESCRIPTIONS: Record<RuleLayer, string> = {
  structure: 'Furniture and fixtures — the build itself.',
  storage: 'Cupboards, lockers and the things you put in them.',
  electrical: 'Batteries, charging and DC runs.',
  plumbing: 'Tanks, pump and water runs.',
}

/** Colour used to draw a layer's system runs on the canvas. */
export const LAYER_COLORS: Record<RuleLayer, string> = {
  structure: 'oklch(0.5 0.02 250)',
  storage: '#a897c4',
  electrical: '#d4a94e',
  plumbing: '#6ba8b5',
}

export const CONFIDENCE_LABELS = {
  verified: 'Verified',
  approximate: 'Approximate',
  community: 'Community',
} as const

export const CONFIDENCE_EXPLANATIONS = {
  verified: 'Measured against a physical vehicle or a manufacturer technical drawing.',
  approximate:
    'Best-effort figures assembled from published specs and conversion drawings. Treat as a starting point and measure before you cut.',
  community:
    'Submitted by a builder and not independently checked. Measure before you cut.',
} as const

/**
 * Rule identifiers. Referenced by `UserSettings.disabledRules`, so these strings
 * are persisted — renaming one silently re-enables a rule the user turned off.
 */
export const RULE_IDS = {
  OBJECT_OVERLAP: 'object-overlap',
  OUT_OF_BOUNDS: 'out-of-bounds',
  OBSTACLE_INTERSECT: 'obstacle-intersect',
  SWING_BLOCKED: 'swing-blocked',
  APERTURE_BLOCKED: 'aperture-blocked',
  STANDING_HEADROOM: 'standing-headroom',
  SITTING_HEADROOM: 'sitting-headroom',
  AISLE_WIDTH: 'aisle-width',
  BED_LENGTH: 'bed-length',
  REACH_HEIGHT: 'reach-height',
  DOOR_EGRESS: 'door-egress',
  TOTAL_PAYLOAD: 'total-payload',
  AXLE_LOAD: 'axle-load',
  DC_RUN_LENGTH: 'dc-run-length',
  WATER_RUN_LENGTH: 'water-run-length',
} as const

export type RuleId = (typeof RULE_IDS)[keyof typeof RULE_IDS]
