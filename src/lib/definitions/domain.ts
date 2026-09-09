/**
 * Core domain types.
 *
 * UNITS: every length in this file is **integer millimetres** and every mass is
 * **grams**. There is exactly one internal unit system; conversion happens only
 * at the display/input boundary in `lib/units.ts`. `Mm` and `Grams` are
 * documentation aliases rather than branded types deliberately — branding would
 * force an `as Mm` cast on every arithmetic result in the geometry layer, and
 * normalising casts in the code that most needs to be correct is a net loss.
 */

export type Mm = number
export type Grams = number
/** Degrees, clockwise, about the vertical (z) axis. */
export type Degrees = number

export type UnitSystem = 'metric' | 'imperial'

export interface Vec3 {
  x: Mm
  y: Mm
  z: Mm
}

export interface Size3 {
  /** Extent along x (across the van) before rotation. */
  w: Mm
  /** Extent along y (along the van) before rotation. */
  d: Mm
  /** Extent along z (vertical). */
  h: Mm
}

/** A 2D point in whichever plane the caller is working in. */
export interface Point2 {
  x: number
  y: number
}

/** Axis-aligned 2D rectangle, used for projected views. */
export interface Rect2 {
  x: number
  y: number
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/**
 * The three 2D projections of the same 3D model.
 * - `top`  looks down:             screen u = x, v = y, through-axis = z
 * - `side` looks at the left wall: screen u = y, v = z, through-axis = x
 * - `rear` looks forward:          screen u = x, v = z, through-axis = y
 */
export type ViewMode = 'top' | 'side' | 'rear'

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

/**
 * Object kinds behave differently under the rules engine:
 * - `fixed`       bolted down; occupies its bounding box; all clearance checks apply
 * - `articulated` fixed, but sweeps through space when operated; checked against
 *                 its swept volume rather than its closed footprint
 * - `loose`       genuinely movable; exempt from clearance and circulation checks
 *                 but still counted for weight, axle load and storage volume
 */
export type ObjectKind = 'fixed' | 'articulated' | 'loose'

export const OBJECT_CATEGORIES = [
  'sleeping',
  'kitchen',
  'seating',
  'storage',
  'utility',
  'electrical',
  'water',
] as const

export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number]

/** How a part moves when operated. */
export type ArticulationKind = 'hinge' | 'slide' | 'swivel' | 'fold'

/**
 * Swept-motion description for an articulated object.
 *
 * The hinge is stored in **van coordinates** rather than relative to the parent
 * object, so the sweep is unambiguous for doors that hinge off a corner.
 */
export interface Articulation {
  kind: ArticulationKind
  /** Pivot point in the top-down plane, in van coordinates. */
  hinge: { x: Mm; y: Mm }
  /** Length of the swinging leaf measured from the hinge. */
  leafLength: Mm
  /** Thickness of the leaf; gives the sweep real area rather than a bare arc. */
  leafThickness: Mm
  /** Angle of the leaf when closed, degrees clockwise from the +x axis. */
  startAngle: Degrees
  /** How far it opens. Positive sweeps clockwise, negative anticlockwise. */
  sweepAngle: Degrees
  /** Vertical extent of the swept volume, absolute z in van coordinates. */
  zRange: { min: Mm; max: Mm }
  /** For `slide`: travel distance along the leaf's closed direction. */
  slideDistance?: Mm
}

/**
 * Connection point for the light "systems" pass (spec section 7).
 * Not consumed by v1 rules; present so the object model does not preclude it.
 */
export interface ConnectionPoint {
  id: string
  system: 'dc' | 'ac' | 'water_fresh' | 'water_grey' | 'gas'
  /** Offset from the object's min corner, before rotation. */
  offset: Vec3
  label?: string
}

export interface VanObject {
  /** Client-generated UUID: makes the sync upsert idempotent. */
  id: string
  projectId: string
  name: string
  category: ObjectCategory
  kind: ObjectKind
  /** Min corner in van coordinates, before rotation. */
  position: Vec3
  size: Size3
  /** Rotation about z, degrees clockwise, applied about the footprint centre. */
  yaw: Degrees
  mass: Grams
  /** Cost in minor currency units (pence/cents). */
  cost: number
  color: string
  /** Present iff `kind === 'articulated'`. */
  articulation: Articulation | null
  connections: ConnectionPoint[]
  /** Paint order within a view; higher draws on top. */
  zIndex: number
  /** Free-text note surfaced in the inspector. */
  notes: string | null
}

/** A catalog entry: a template from which a `VanObject` is created. */
export interface CatalogItem {
  slug: string
  name: string
  category: ObjectCategory
  kind: ObjectKind
  size: Size3
  mass: Grams
  cost: number
  color: string
  /**
   * Articulation described relative to the object's own footprint, converted to
   * van coordinates when the item is placed.
   */
  articulationTemplate?: {
    kind: ArticulationKind
    /** Which footprint corner the leaf pivots on, in the object's own frame. */
    hingeCorner: 'front-left' | 'front-right' | 'back-left' | 'back-right'
    /**
     * Which face of the object the door is mounted on, in its own frame.
     *
     * The closed leaf lies flat along this face; opening swings it outward.
     */
    doorFace: 'front' | 'back' | 'left' | 'right'
    leafLength: Mm
    leafThickness: Mm
    sweepAngle: Degrees
    /** Vertical span of the sweep, as offsets from the object's own base. */
    zOffsetMin: Mm
    zOffsetMax: Mm
  }
  /**
   * Where this thing normally lives.
   *
   * An overhead locker dropped on the floor is not wrong so much as silly, and
   * the user has to drag it up before the layout means anything. Placement tries
   * this height first and falls back to the floor if it will not fit.
   */
  mount?: 'floor' | 'worktop' | 'overhead' | 'roof'
  description?: string
}

// ---------------------------------------------------------------------------
// Vans
// ---------------------------------------------------------------------------

/**
 * Confidence in a dimension's provenance, displayed next to the number it
 * qualifies. Spec section 3 is explicit that unverified figures must not be
 * presented as fact.
 */
export type Confidence = 'verified' | 'approximate' | 'community'

export type ObstacleKind =
  | 'wheel_well'
  | 'b_pillar'
  | 'aperture_side'
  | 'aperture_rear'
  | 'mount_point'
  | 'intrusion'

export interface VanObstacle {
  id: string
  vanModelId: string
  kind: ObstacleKind
  name: string
  position: Vec3
  size: Size3
  /** Door swing envelope, for aperture obstacles that open. */
  articulation: Articulation | null
  confidence: Confidence
}

/**
 * One step of the wall taper profile: at height `z` the interior is inset by
 * `insetLeft` / `insetRight` from the nominal maximum width. Vans are not boxes,
 * and this is what makes a shoulder-height cabinet fail where a floor cabinet
 * passes.
 */
export interface TaperPoint {
  z: Mm
  insetLeft: Mm
  insetRight: Mm
}

export interface VanModel {
  id: string
  make: string
  model: string
  variant: string
  wheelbaseLabel: string
  roofLabel: string
  /** Interior cargo-area dimensions. */
  interior: Size3
  taper: TaperPoint[]
  /** Kerb-to-GVWR headroom available for the build and its occupants. */
  payload: Grams
  gvwr: Grams
  /** Axle positions in van coordinates, used for load distribution. */
  frontAxleY: Mm
  rearAxleY: Mm
  /** Mass already on each axle before anything is built. */
  kerbFrontAxle: Grams
  kerbRearAxle: Grams
  confidence: Confidence
  /** Where the numbers came from; shown in the confidence tooltip. */
  sourceNote: string | null
  obstacles: VanObstacle[]
}

/**
 * Per-project corrections to a preset. Spec open question, answered: these stay
 * local to the project in v1 and never write back to the shared library.
 */
export interface VanOverrides {
  interior?: Partial<Size3>
  taper?: TaperPoint[]
  payload?: Grams
  obstacles?: Record<string, ObstacleOverride | null>
}

export interface ObstacleOverride {
  position?: Partial<Vec3>
  size?: Partial<Size3>
}

/** A van model with project overrides applied — what the rules actually run against. */
export interface ResolvedVan {
  interior: Size3
  taper: TaperPoint[]
  payload: Grams
  gvwr: Grams
  frontAxleY: Mm
  rearAxleY: Mm
  kerbFrontAxle: Grams
  kerbRearAxle: Grams
  obstacles: VanObstacle[]
  modelId: string | null
  label: string
  confidence: Confidence
  sourceNote: string | null
  /** True when the user has edited any dimension away from the preset. */
  hasOverrides: boolean
}

// ---------------------------------------------------------------------------
// Projects and settings
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  userId: string
  name: string
  vanModelId: string | null
  /** Used when no preset is selected, or as the base for overrides. */
  customInterior: Size3 | null
  overrides: VanOverrides
  /** Bumped by the server on every successful sync; drives conflict detection. */
  revision: number
  /** Id of the client sync that last wrote here; see the schema for why. */
  lastSyncId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  vanLabel: string
  objectCount: number
  revision: number
  updatedAt: string
}

export interface UserSettings {
  userId: string
  /** Optional; when absent, ergonomic rules report only the 6'0" standard. */
  heightMm: Mm | null
  unitSystem: UnitSystem
  /** Rule ids the user has switched off. Every rule is individually toggleable. */
  disabledRules: string[]
  gridMm: Mm
  ghostingEnabled: boolean
  snapToObjects: boolean
}

/** A whole editable scene: everything the editor and the rules engine need. */
export interface Scene {
  project: Project
  van: ResolvedVan
  objects: VanObject[]
}
