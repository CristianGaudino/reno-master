/**
 * Seed van preset library.
 *
 * READ THIS BEFORE TRUSTING A NUMBER IN THIS FILE.
 *
 * Spec section 3 flags the problem and it is real: accurate interior dimensions
 * are not available in any clean public database. Manufacturers publish
 * load-area figures that do not match what a builder needs — maximum width
 * rather than width between the wheel wells, height at the centreline rather
 * than at the wall, load length measured to the doors rather than to the
 * bulkhead you are actually building against.
 *
 * So every figure here is assembled from published specs and conversion
 * drawings, and every one of them is tagged `approximate`. Nothing in this file
 * is tagged `verified`, the confidence badge is shown in the UI next to the
 * dimension it qualifies, and any dimension can be overridden per project.
 *
 * Treat these as a starting canvas, not a measurement. Measure your own van
 * before you cut anything, and correct the project when you do.
 *
 * Coordinate frame is the one defined in `geometry/frame.ts`: origin at the
 * interior floor, front-left corner of the cargo area; x across, y toward the
 * rear doors, z up. Axle positions are negative where an axle sits forward of
 * the bulkhead.
 */

import type { Confidence, Mm, TaperPoint, VanModel, VanObstacle } from './definitions'

const APPROXIMATE: Confidence = 'approximate'

const SOURCE_NOTE =
  'Assembled from published load-area specs and conversion drawings. Not measured against a physical vehicle — check against your own van before cutting.'

interface ObstacleSpec {
  kind: VanObstacle['kind']
  name: string
  x: Mm
  y: Mm
  z: Mm
  w: Mm
  d: Mm
  h: Mm
  articulation?: VanObstacle['articulation']
}

interface VanSpec {
  id: string
  make: string
  model: string
  variant?: string
  wheelbaseLabel: string
  roofLabel: string
  interior: { w: Mm; d: Mm; h: Mm }
  taper: TaperPoint[]
  payload: number
  gvwr: number
  frontAxleY: Mm
  rearAxleY: Mm
  kerbFrontAxle: number
  kerbRearAxle: number
  /** Wheel arch intrusion: how far in from each wall, and its size. */
  wheelWell: { inset: Mm; y: Mm; length: Mm; height: Mm }
  /** Sliding door opening, measured along the van from the bulkhead. */
  sideDoor: { y: Mm; width: Mm; height: Mm } | null
  rearDoor: { width: Mm; height: Mm }
  bPillar?: { y: Mm; depth: Mm } | null
}

/**
 * Taper profiles.
 *
 * A van is widest around shoulder height and narrows both at the floor (where
 * the body sides kick in) and toward the roof. `insetLeft`/`insetRight` are
 * measured from the nominal maximum width.
 */
const TAPER_PROFILES = {
  /** Sprinter/Transit/Crafter-style: noticeable curve toward the roof. */
  curved: (height: Mm): TaperPoint[] => [
    { z: 0, insetLeft: 30, insetRight: 30 },
    { z: 700, insetLeft: 0, insetRight: 0 },
    { z: 1300, insetLeft: 55, insetRight: 55 },
    { z: height, insetLeft: 215, insetRight: 215 },
  ],
  /** ProMaster/Ducato-style: famously near-vertical walls. */
  boxy: (height: Mm): TaperPoint[] => [
    { z: 0, insetLeft: 18, insetRight: 18 },
    { z: 600, insetLeft: 0, insetRight: 0 },
    { z: 1400, insetLeft: 20, insetRight: 20 },
    { z: height, insetLeft: 120, insetRight: 120 },
  ],
  /** Low-roof car-derived vans: shallower body, stronger taper near the roof. */
  low: (height: Mm): TaperPoint[] => [
    { z: 0, insetLeft: 28, insetRight: 28 },
    { z: 600, insetLeft: 0, insetRight: 0 },
    { z: height, insetLeft: 150, insetRight: 150 },
  ],
} as const

/**
 * The eight families named in spec section 3, plus the two smaller vans.
 *
 * Payload figures are for the common 3.5t (or equivalent) variant; heavier
 * chassis exist for most of these and will differ substantially.
 */
const SPECS: VanSpec[] = [
  {
    id: 'sprinter-144-high',
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    wheelbaseLabel: '144" WB',
    roofLabel: 'High roof',
    interior: { w: 1787, d: 3265, h: 1940 },
    taper: TAPER_PROFILES.curved(1940),
    payload: 1_180_000,
    gvwr: 3_500_000,
    frontAxleY: -700,
    rearAxleY: 2958,
    kerbFrontAxle: 1_280_000,
    kerbRearAxle: 1_040_000,
    wheelWell: { inset: 205, y: 2350, length: 1010, height: 300 },
    sideDoor: { y: 700, width: 1300, height: 1700 },
    rearDoor: { width: 1550, height: 1740 },
    bPillar: { y: 660, depth: 60 },
  },
  {
    id: 'sprinter-170-high',
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    wheelbaseLabel: '170" WB',
    roofLabel: 'High roof',
    interior: { w: 1787, d: 4300, h: 1940 },
    taper: TAPER_PROFILES.curved(1940),
    payload: 1_100_000,
    gvwr: 3_500_000,
    frontAxleY: -700,
    rearAxleY: 3618,
    kerbFrontAxle: 1_300_000,
    kerbRearAxle: 1_100_000,
    wheelWell: { inset: 205, y: 3010, length: 1010, height: 300 },
    sideDoor: { y: 700, width: 1300, height: 1700 },
    rearDoor: { width: 1550, height: 1740 },
    bPillar: { y: 660, depth: 60 },
  },
  {
    id: 'sprinter-144-standard',
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    wheelbaseLabel: '144" WB',
    roofLabel: 'Standard roof',
    interior: { w: 1787, d: 3265, h: 1650 },
    taper: TAPER_PROFILES.curved(1650),
    payload: 1_220_000,
    gvwr: 3_500_000,
    frontAxleY: -700,
    rearAxleY: 2958,
    kerbFrontAxle: 1_260_000,
    kerbRearAxle: 1_020_000,
    wheelWell: { inset: 205, y: 2350, length: 1010, height: 300 },
    sideDoor: { y: 700, width: 1300, height: 1500 },
    rearDoor: { width: 1550, height: 1500 },
    bPillar: { y: 660, depth: 60 },
  },
  {
    id: 'transit-148-high',
    make: 'Ford',
    model: 'Transit',
    wheelbaseLabel: '148" WB',
    roofLabel: 'High roof',
    interior: { w: 1784, d: 3500, h: 1956 },
    taper: TAPER_PROFILES.curved(1956),
    payload: 1_240_000,
    gvwr: 3_500_000,
    frontAxleY: -750,
    rearAxleY: 3009,
    kerbFrontAxle: 1_220_000,
    kerbRearAxle: 1_040_000,
    wheelWell: { inset: 200, y: 2520, length: 1000, height: 290 },
    sideDoor: { y: 780, width: 1300, height: 1730 },
    rearDoor: { width: 1565, height: 1800 },
    bPillar: { y: 730, depth: 60 },
  },
  {
    id: 'transit-130-medium',
    make: 'Ford',
    model: 'Transit',
    wheelbaseLabel: '130" WB',
    roofLabel: 'Medium roof',
    interior: { w: 1784, d: 3044, h: 1727 },
    taper: TAPER_PROFILES.curved(1727),
    payload: 1_300_000,
    gvwr: 3_500_000,
    frontAxleY: -750,
    rearAxleY: 2552,
    kerbFrontAxle: 1_180_000,
    kerbRearAxle: 1_000_000,
    wheelWell: { inset: 200, y: 2100, length: 1000, height: 290 },
    sideDoor: { y: 760, width: 1300, height: 1520 },
    rearDoor: { width: 1565, height: 1580 },
    bPillar: { y: 710, depth: 60 },
  },
  {
    id: 'promaster-136-high',
    make: 'Ram',
    model: 'ProMaster',
    wheelbaseLabel: '136" WB',
    roofLabel: 'High roof',
    interior: { w: 1866, d: 3170, h: 1930 },
    taper: TAPER_PROFILES.boxy(1930),
    payload: 1_800_000,
    gvwr: 4_050_000,
    frontAxleY: -520,
    rearAxleY: 2934,
    kerbFrontAxle: 1_420_000,
    kerbRearAxle: 830_000,
    wheelWell: { inset: 170, y: 2300, length: 980, height: 290 },
    sideDoor: { y: 620, width: 1250, height: 1690 },
    rearDoor: { width: 1560, height: 1770 },
    bPillar: { y: 580, depth: 55 },
  },
  {
    id: 'promaster-159-high',
    make: 'Ram',
    model: 'ProMaster',
    wheelbaseLabel: '159" WB',
    roofLabel: 'High roof',
    interior: { w: 1866, d: 3800, h: 1930 },
    taper: TAPER_PROFILES.boxy(1930),
    payload: 1_720_000,
    gvwr: 4_050_000,
    frontAxleY: -520,
    rearAxleY: 3518,
    kerbFrontAxle: 1_450_000,
    kerbRearAxle: 900_000,
    wheelWell: { inset: 170, y: 2880, length: 980, height: 290 },
    sideDoor: { y: 620, width: 1250, height: 1690 },
    rearDoor: { width: 1560, height: 1770 },
    bPillar: { y: 580, depth: 55 },
  },
  {
    id: 'crafter-mwb-high',
    make: 'Volkswagen',
    model: 'Crafter',
    variant: 'also sold as MAN TGE',
    wheelbaseLabel: 'MWB',
    roofLabel: 'High roof',
    interior: { w: 1832, d: 3450, h: 1861 },
    taper: TAPER_PROFILES.curved(1861),
    payload: 1_260_000,
    gvwr: 3_500_000,
    frontAxleY: -700,
    rearAxleY: 2940,
    kerbFrontAxle: 1_210_000,
    kerbRearAxle: 1_030_000,
    wheelWell: { inset: 190, y: 2400, length: 1000, height: 295 },
    sideDoor: { y: 720, width: 1311, height: 1700 },
    rearDoor: { width: 1562, height: 1750 },
    bPillar: { y: 680, depth: 60 },
  },
  {
    id: 'ducato-l3h2',
    make: 'Fiat',
    model: 'Ducato',
    variant: 'also sold as Peugeot Boxer and Citroën Relay',
    wheelbaseLabel: 'L3',
    roofLabel: 'H2',
    interior: { w: 1870, d: 3705, h: 1932 },
    taper: TAPER_PROFILES.boxy(1932),
    payload: 1_450_000,
    gvwr: 3_500_000,
    frontAxleY: -600,
    rearAxleY: 3435,
    kerbFrontAxle: 1_180_000,
    kerbRearAxle: 870_000,
    wheelWell: { inset: 175, y: 2790, length: 1000, height: 290 },
    sideDoor: { y: 700, width: 1250, height: 1755 },
    rearDoor: { width: 1562, height: 1790 },
    bPillar: { y: 660, depth: 55 },
  },
  {
    id: 'master-l3h2',
    make: 'Renault',
    model: 'Master',
    variant: 'also sold as Vauxhall/Opel Movano and Nissan Interstar',
    wheelbaseLabel: 'L3',
    roofLabel: 'H2',
    interior: { w: 1765, d: 3733, h: 1894 },
    taper: TAPER_PROFILES.curved(1894),
    payload: 1_390_000,
    gvwr: 3_500_000,
    frontAxleY: -600,
    rearAxleY: 3082,
    kerbFrontAxle: 1_150_000,
    kerbRearAxle: 960_000,
    wheelWell: { inset: 195, y: 2650, length: 1010, height: 300 },
    sideDoor: { y: 720, width: 1270, height: 1780 },
    rearDoor: { width: 1580, height: 1820 },
    bPillar: { y: 680, depth: 60 },
  },
  {
    id: 'transit-custom-l2h1',
    make: 'Ford',
    model: 'Transit Custom',
    wheelbaseLabel: 'L2',
    roofLabel: 'Low roof',
    interior: { w: 1775, d: 2555, h: 1406 },
    taper: TAPER_PROFILES.low(1406),
    payload: 1_130_000,
    gvwr: 3_200_000,
    frontAxleY: -600,
    rearAxleY: 2700,
    kerbFrontAxle: 1_090_000,
    kerbRearAxle: 780_000,
    wheelWell: { inset: 210, y: 1750, length: 950, height: 280 },
    sideDoor: { y: 500, width: 1030, height: 1320 },
    rearDoor: { width: 1400, height: 1340 },
    bPillar: { y: 470, depth: 55 },
  },
  {
    id: 'transporter-t61-lwb',
    make: 'Volkswagen',
    model: 'Transporter',
    variant: 'T6.1',
    wheelbaseLabel: 'LWB',
    roofLabel: 'Low roof',
    interior: { w: 1700, d: 2930, h: 1410 },
    taper: TAPER_PROFILES.low(1410),
    payload: 1_000_000,
    gvwr: 3_080_000,
    frontAxleY: -560,
    rearAxleY: 2840,
    kerbFrontAxle: 1_040_000,
    kerbRearAxle: 740_000,
    wheelWell: { inset: 215, y: 1980, length: 940, height: 275 },
    sideDoor: { y: 480, width: 1020, height: 1290 },
    rearDoor: { width: 1473, height: 1300 },
    bPillar: { y: 450, depth: 55 },
  },
]

/**
 * Depth into the van that an aperture volume occupies.
 *
 * This is the door reveal, not the space you need in front of the door. Keeping
 * it shallow makes "blocks the aperture" mean *physically in the doorway*; the
 * separate question of whether you can actually step in and get past is the
 * door-egress rule's job. At 120mm a bed platform running along the wall was
 * being reported as blocking a slider it comfortably clears.
 */
const APERTURE_DEPTH_MM = 60

/**
 * Expand a compact spec into a full model with its obstacles.
 *
 * The sliding door is placed on the right-hand wall (x maximum). Which side that
 * is depends on the market — right for left-hand-drive, left for right-hand-drive
 * — and it can be moved per project, so this is a default rather than a claim.
 */
function expand(spec: VanSpec): VanModel {
  const obstacles: VanObstacle[] = []
  // Everything is rounded here rather than at each call site: centring a door in
  // the aperture produces half-millimetres, and the whole app — schema included
  // — is integer millimetres.
  const push = (obstacle: ObstacleSpec) => {
    obstacles.push({
      id: `${spec.id}--${obstacle.kind}-${obstacles.length}`,
      vanModelId: spec.id,
      kind: obstacle.kind,
      name: obstacle.name,
      position: {
        x: Math.round(obstacle.x),
        y: Math.round(obstacle.y),
        z: Math.round(obstacle.z),
      },
      size: {
        w: Math.round(obstacle.w),
        d: Math.round(obstacle.d),
        h: Math.round(obstacle.h),
      },
      articulation: obstacle.articulation ?? null,
      confidence: APPROXIMATE,
    })
  }

  const { wheelWell } = spec

  push({
    kind: 'wheel_well',
    name: 'Left wheel well',
    x: 0,
    y: wheelWell.y,
    z: 0,
    w: wheelWell.inset,
    d: wheelWell.length,
    h: wheelWell.height,
  })

  push({
    kind: 'wheel_well',
    name: 'Right wheel well',
    x: spec.interior.w - wheelWell.inset,
    y: wheelWell.y,
    z: 0,
    w: wheelWell.inset,
    d: wheelWell.length,
    h: wheelWell.height,
  })

  if (spec.bPillar) {
    push({
      kind: 'b_pillar',
      name: 'B-pillar',
      x: spec.interior.w - spec.bPillar.depth,
      y: spec.bPillar.y,
      z: 0,
      w: spec.bPillar.depth,
      d: 90,
      h: spec.interior.h,
    })
  }

  if (spec.sideDoor) {
    push({
      kind: 'aperture_side',
      name: 'Sliding door aperture',
      x: spec.interior.w - APERTURE_DEPTH_MM,
      y: spec.sideDoor.y,
      z: 0,
      w: APERTURE_DEPTH_MM,
      d: spec.sideDoor.width,
      h: spec.sideDoor.height,
      // The leaf slides back along the outside of the van, so its envelope never
      // reaches the interior. Recorded so the model supports it and the view can
      // draw it, not because it constrains the layout.
      articulation: {
        kind: 'slide',
        hinge: { x: spec.interior.w, y: spec.sideDoor.y + spec.sideDoor.width },
        leafLength: spec.sideDoor.width,
        leafThickness: 60,
        startAngle: 90,
        sweepAngle: 0,
        slideDistance: spec.sideDoor.width,
        zRange: { min: 0, max: spec.sideDoor.height },
      },
    })
  }

  push({
    kind: 'aperture_rear',
    name: 'Rear door aperture',
    x: (spec.interior.w - spec.rearDoor.width) / 2,
    y: spec.interior.d - APERTURE_DEPTH_MM,
    z: 0,
    w: spec.rearDoor.width,
    d: APERTURE_DEPTH_MM,
    h: spec.rearDoor.height,
    // Rear doors swing outward, away from the interior.
    articulation: {
      kind: 'hinge',
      hinge: { x: (spec.interior.w - spec.rearDoor.width) / 2, y: spec.interior.d },
      leafLength: spec.rearDoor.width / 2,
      leafThickness: 60,
      startAngle: 0,
      sweepAngle: 90,
      zRange: { min: 0, max: spec.rearDoor.height },
    },
  })

  return {
    id: spec.id,
    make: spec.make,
    model: spec.model,
    variant: spec.variant ?? '',
    wheelbaseLabel: spec.wheelbaseLabel,
    roofLabel: spec.roofLabel,
    interior: spec.interior,
    taper: spec.taper,
    payload: spec.payload,
    gvwr: spec.gvwr,
    frontAxleY: spec.frontAxleY,
    rearAxleY: spec.rearAxleY,
    kerbFrontAxle: spec.kerbFrontAxle,
    kerbRearAxle: spec.kerbRearAxle,
    confidence: APPROXIMATE,
    sourceNote: SOURCE_NOTE,
    obstacles,
  }
}

export const SEED_VAN_MODELS: VanModel[] = SPECS.map(expand)

export function vanModelLabel(model: {
  make: string
  model: string
  wheelbaseLabel: string
  roofLabel: string
}): string {
  return `${model.make} ${model.model} ${model.wheelbaseLabel} ${model.roofLabel}`
}
