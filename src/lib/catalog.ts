/**
 * Furniture and fixture catalog.
 *
 * Default dimensions, mass and cost for the things that actually go in a van,
 * grouped by the categories in spec section 6. Everything is editable once
 * placed — these are sensible starting points, not fixed products.
 *
 * Masses are the ones that matter. Water is 1kg per litre and it is almost
 * always the heaviest single item in a build; leisure batteries and plywood come
 * next. Those three are what push people over payload, so their figures are the
 * ones worth getting roughly right.
 *
 * Costs are rough retail in minor units (pence), for order-of-magnitude
 * budgeting rather than quoting.
 */

import { CATEGORY_COLORS } from './constants'
import type { CatalogItem } from './definitions'

/** Litres of water, as grams. Water is 1kg/litre. */
const water = (litres: number) => litres * 1000

export const CATALOG: CatalogItem[] = [
  // -------------------------------------------------------------------------
  // Sleeping
  // -------------------------------------------------------------------------
  {
    slug: 'fixed-bed-transverse',
    name: 'Fixed bed (across van)',
    category: 'sleeping',
    kind: 'fixed',
    size: { w: 1700, d: 1400, h: 500 },
    mass: 55_000,
    cost: 18_000,
    color: CATEGORY_COLORS.sleeping,
    description:
      'Runs across the van with storage underneath. Interior width is what limits how tall you can be and still lie flat — 1700mm clears the floor width of most high-roof vans as drawn, and anyone near six foot will want it turned lengthways or the walls flared.',
  },
  {
    slug: 'fixed-bed-longitudinal',
    name: 'Fixed bed (along van)',
    category: 'sleeping',
    kind: 'fixed',
    size: { w: 1400, d: 1900, h: 500 },
    mass: 58_000,
    cost: 19_000,
    color: CATEGORY_COLORS.sleeping,
    description: 'Runs front to back. Costs more floor length but takes any height of person.',
  },
  {
    slug: 'rock-and-roll-bed',
    name: 'Rock and roll bed',
    category: 'sleeping',
    kind: 'fixed',
    size: { w: 1200, d: 900, h: 1050 },
    mass: 75_000,
    cost: 90_000,
    color: CATEGORY_COLORS.sleeping,
    description: 'Seat that folds flat. Heavy, and usually needs crash-tested floor mounts.',
  },
  {
    slug: 'pull-out-slat-bed',
    name: 'Pull-out slat bed',
    category: 'sleeping',
    kind: 'articulated',
    size: { w: 1400, d: 1000, h: 480 },
    mass: 45_000,
    cost: 22_000,
    color: CATEGORY_COLORS.sleeping,
    articulationTemplate: {
      kind: 'slide',
      hingeCorner: 'back-left',
      doorFace: 'back',
      leafLength: 700,
      leafThickness: 1400,
      sweepAngle: 0,
      zOffsetMin: 0,
      zOffsetMax: 480,
    },
    description: 'Extends into the aisle at night. The extended footprint is what gets checked.',
  },

  // -------------------------------------------------------------------------
  // Kitchen
  // -------------------------------------------------------------------------
  {
    slug: 'galley-unit',
    name: 'Galley unit',
    category: 'kitchen',
    kind: 'fixed',
    size: { w: 600, d: 1200, h: 900 },
    mass: 45_000,
    cost: 35_000,
    color: CATEGORY_COLORS.kitchen,
    description: 'Worktop with cupboards under. 900mm is a comfortable working height.',
  },
  {
    slug: 'compressor-fridge',
    name: 'Compressor fridge',
    category: 'kitchen',
    kind: 'articulated',
    size: { w: 530, d: 550, h: 620 },
    mass: 22_000,
    cost: 55_000,
    color: CATEGORY_COLORS.kitchen,
    articulationTemplate: {
      kind: 'hinge',
      hingeCorner: 'front-left',
      doorFace: 'front',
      leafLength: 530,
      leafThickness: 45,
      sweepAngle: 100,
      zOffsetMin: 60,
      zOffsetMax: 620,
    },
    description:
      'The classic clearance failure: the door needs its full swing, and a bed three inches too close stops it opening.',
  },
  {
    slug: 'drawer-fridge',
    name: 'Drawer fridge',
    category: 'kitchen',
    kind: 'articulated',
    size: { w: 550, d: 570, h: 500 },
    mass: 26_000,
    cost: 78_000,
    color: CATEGORY_COLORS.kitchen,
    articulationTemplate: {
      kind: 'slide',
      hingeCorner: 'front-left',
      doorFace: 'front',
      leafLength: 550,
      leafThickness: 500,
      sweepAngle: 0,
      zOffsetMin: 0,
      zOffsetMax: 500,
    },
    description: 'Pulls straight out, so it needs depth in front rather than swing.',
  },
  {
    slug: 'two-burner-hob',
    name: 'Two-burner hob',
    category: 'kitchen',
    kind: 'fixed',
    size: { w: 500, d: 350, h: 120 },
    mass: 6_000,
    cost: 12_000,
    color: CATEGORY_COLORS.kitchen,
  },
  {
    slug: 'sink-unit',
    name: 'Sink',
    category: 'kitchen',
    kind: 'fixed',
    size: { w: 400, d: 380, h: 160 },
    mass: 4_500,
    cost: 8_000,
    color: CATEGORY_COLORS.kitchen,
  },
  {
    slug: 'overhead-locker',
    name: 'Overhead locker',
    category: 'kitchen',
    kind: 'articulated',
    size: { w: 300, d: 900, h: 400 },
    mass: 14_000,
    cost: 14_000,
    color: CATEGORY_COLORS.kitchen,
    articulationTemplate: {
      kind: 'hinge',
      hingeCorner: 'front-left',
      doorFace: 'front',
      leafLength: 450,
      leafThickness: 20,
      sweepAngle: 90,
      zOffsetMin: 0,
      zOffsetMax: 400,
    },
  },

  // -------------------------------------------------------------------------
  // Seating
  // -------------------------------------------------------------------------
  {
    slug: 'swivel-seat',
    name: 'Swivel seat',
    category: 'seating',
    kind: 'articulated',
    size: { w: 520, d: 520, h: 900 },
    mass: 24_000,
    cost: 30_000,
    color: CATEGORY_COLORS.seating,
    articulationTemplate: {
      kind: 'swivel',
      hingeCorner: 'front-left',
      doorFace: 'back',
      leafLength: 620,
      leafThickness: 520,
      sweepAngle: 180,
      zOffsetMin: 300,
      zOffsetMax: 900,
    },
    description: 'Needs room to turn. The swept circle is what gets checked, not the seat box.',
  },
  {
    slug: 'bench-seat',
    name: 'Bench seat',
    category: 'seating',
    kind: 'fixed',
    size: { w: 1100, d: 450, h: 450 },
    mass: 28_000,
    cost: 20_000,
    color: CATEGORY_COLORS.seating,
  },
  {
    slug: 'fold-out-table',
    name: 'Fold-out table',
    category: 'seating',
    kind: 'articulated',
    size: { w: 600, d: 80, h: 40 },
    mass: 7_000,
    cost: 9_000,
    color: CATEGORY_COLORS.seating,
    articulationTemplate: {
      kind: 'fold',
      hingeCorner: 'front-left',
      doorFace: 'front',
      leafLength: 600,
      leafThickness: 40,
      sweepAngle: 90,
      zOffsetMin: 0,
      zOffsetMax: 40,
    },
    description: 'Folds down into the aisle. Check it does not block the walkway when open.',
  },

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------
  {
    slug: 'wardrobe',
    name: 'Wardrobe',
    category: 'storage',
    kind: 'articulated',
    size: { w: 500, d: 600, h: 1400 },
    mass: 32_000,
    cost: 22_000,
    color: CATEGORY_COLORS.storage,
    articulationTemplate: {
      kind: 'hinge',
      hingeCorner: 'front-left',
      doorFace: 'front',
      leafLength: 500,
      leafThickness: 20,
      sweepAngle: 100,
      zOffsetMin: 0,
      zOffsetMax: 1400,
    },
  },
  {
    slug: 'garage-storage',
    name: 'Rear garage',
    category: 'storage',
    kind: 'fixed',
    size: { w: 1700, d: 900, h: 450 },
    mass: 35_000,
    cost: 20_000,
    color: CATEGORY_COLORS.storage,
    description:
      'Under-bed storage at the back. Watch the rear axle: this is the easiest place in the van to overload.',
  },
  {
    slug: 'shelf-unit',
    name: 'Open shelving',
    category: 'storage',
    kind: 'fixed',
    size: { w: 300, d: 800, h: 900 },
    mass: 15_000,
    cost: 10_000,
    color: CATEGORY_COLORS.storage,
  },
  {
    slug: 'gear-crate',
    name: 'Gear crate',
    category: 'storage',
    kind: 'loose',
    size: { w: 400, d: 600, h: 320 },
    mass: 12_000,
    cost: 2_500,
    color: CATEGORY_COLORS.storage,
    description: 'Loose: exempt from clearance checks, but it still counts toward payload.',
  },

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------
  {
    slug: 'shower-tray',
    name: 'Shower cubicle',
    category: 'utility',
    kind: 'articulated',
    size: { w: 700, d: 700, h: 1900 },
    mass: 40_000,
    cost: 45_000,
    color: CATEGORY_COLORS.utility,
    articulationTemplate: {
      kind: 'hinge',
      hingeCorner: 'front-left',
      doorFace: 'front',
      leafLength: 700,
      leafThickness: 25,
      sweepAngle: 95,
      zOffsetMin: 0,
      zOffsetMax: 1900,
    },
  },
  {
    slug: 'cassette-toilet',
    name: 'Cassette toilet',
    category: 'utility',
    kind: 'fixed',
    size: { w: 400, d: 450, h: 450 },
    mass: 15_000,
    cost: 40_000,
    color: CATEGORY_COLORS.utility,
  },
  {
    slug: 'portable-toilet',
    name: 'Portable toilet',
    category: 'utility',
    kind: 'loose',
    size: { w: 380, d: 420, h: 420 },
    mass: 9_000,
    cost: 9_000,
    color: CATEGORY_COLORS.utility,
  },
  {
    slug: 'diesel-heater',
    name: 'Diesel heater',
    category: 'utility',
    kind: 'fixed',
    size: { w: 300, d: 130, h: 130 },
    mass: 4_000,
    cost: 22_000,
    color: CATEGORY_COLORS.utility,
  },
  {
    slug: 'roof-fan',
    name: 'Roof fan',
    category: 'utility',
    kind: 'fixed',
    size: { w: 400, d: 400, h: 60 },
    mass: 3_500,
    cost: 25_000,
    color: CATEGORY_COLORS.utility,
  },

  // -------------------------------------------------------------------------
  // Electrical
  // -------------------------------------------------------------------------
  {
    slug: 'leisure-battery-100',
    name: 'Leisure battery (100Ah LiFePO4)',
    category: 'electrical',
    kind: 'fixed',
    size: { w: 330, d: 175, h: 220 },
    mass: 13_000,
    cost: 45_000,
    color: CATEGORY_COLORS.electrical,
    description: 'Heavy and worth positioning deliberately — keep it near the middle of the wheelbase.',
  },
  {
    slug: 'leisure-battery-agm',
    name: 'Leisure battery (110Ah AGM)',
    category: 'electrical',
    kind: 'fixed',
    size: { w: 350, d: 175, h: 190 },
    mass: 30_000,
    cost: 14_000,
    color: CATEGORY_COLORS.electrical,
    description: 'Less than half the price of lithium and more than twice the weight.',
  },
  {
    slug: 'inverter',
    name: 'Inverter',
    category: 'electrical',
    kind: 'fixed',
    size: { w: 300, d: 200, h: 100 },
    mass: 5_000,
    cost: 20_000,
    color: CATEGORY_COLORS.electrical,
  },
  {
    slug: 'solar-controller',
    name: 'Solar controller',
    category: 'electrical',
    kind: 'fixed',
    size: { w: 180, d: 130, h: 70 },
    mass: 1_200,
    cost: 12_000,
    color: CATEGORY_COLORS.electrical,
  },
  {
    slug: 'fuse-panel',
    name: 'Distribution panel',
    category: 'electrical',
    kind: 'fixed',
    size: { w: 250, d: 120, h: 200 },
    mass: 2_000,
    cost: 9_000,
    color: CATEGORY_COLORS.electrical,
  },

  // -------------------------------------------------------------------------
  // Water
  // -------------------------------------------------------------------------
  {
    slug: 'fresh-tank-100',
    name: 'Fresh water tank (100L)',
    category: 'water',
    kind: 'fixed',
    size: { w: 800, d: 500, h: 300 },
    mass: water(100) + 8_000,
    cost: 15_000,
    color: CATEGORY_COLORS.water,
    description:
      'Mass shown is full: 100kg of water plus the tank. Usually the single heaviest item in a build.',
  },
  {
    slug: 'fresh-tank-60',
    name: 'Fresh water tank (60L)',
    category: 'water',
    kind: 'fixed',
    size: { w: 650, d: 450, h: 270 },
    mass: water(60) + 6_000,
    cost: 11_000,
    color: CATEGORY_COLORS.water,
    description: 'Mass shown is full.',
  },
  {
    slug: 'grey-tank-40',
    name: 'Grey water tank (40L)',
    category: 'water',
    kind: 'fixed',
    size: { w: 600, d: 380, h: 250 },
    mass: water(40) + 5_000,
    cost: 9_000,
    color: CATEGORY_COLORS.water,
    description: 'Mass shown is full.',
  },
  {
    slug: 'water-pump',
    name: 'Water pump',
    category: 'water',
    kind: 'fixed',
    size: { w: 200, d: 110, h: 110 },
    mass: 1_500,
    cost: 6_000,
    color: CATEGORY_COLORS.water,
  },
  {
    slug: 'water-heater',
    name: 'Water heater',
    category: 'water',
    kind: 'fixed',
    size: { w: 380, d: 280, h: 280 },
    mass: 8_000,
    cost: 38_000,
    color: CATEGORY_COLORS.water,
  },
]

export function catalogItem(slug: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.slug === slug)
}

/** Catalog grouped by category, in the display order the panel uses. */
export function catalogByCategory(): Array<{ category: string; items: CatalogItem[] }> {
  const groups = new Map<string, CatalogItem[]>()
  for (const item of CATALOG) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
}
