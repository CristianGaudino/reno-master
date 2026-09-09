/**
 * Pre-built layouts (spec section 5).
 *
 * **Templates fork.** Loading one copies its objects into the project and then
 * forgets where they came from — there is no ongoing link, so changing a
 * template later never reaches back into a build someone has already started,
 * and the user owns what they change.
 *
 * ## Why these are not lists of coordinates
 *
 * A Transit is 300mm longer than a Sprinter, a ProMaster is 80mm wider, and a
 * Transit Custom is 700mm shorter than any of them. A template written as fixed
 * millimetres would suit exactly one van and pile up on itself in the rest.
 *
 * So a template describes *runs*: "down the left wall from the front, galley
 * then fridge" and "bed across the back on the arches". Items in a run are laid
 * nose to tail in the order they are declared, and a run stops where the
 * end-anchored items begin. That produces a layout that holds together in a
 * short van and simply has more elbow room in a long one.
 *
 * They remain starting points rather than finished builds — the rules engine
 * will still have opinions, and in a van that is genuinely too small for a wet
 * room it should.
 */

import { catalogItem } from './catalog'
import { articulationFromTemplate, narrowestXRangeBetween } from './geometry'
import type { CatalogItem, Mm, ResolvedVan, VanObject } from './definitions'

/** Which end of the van a run starts from. */
type AlongAnchor = 'front' | 'rear'

/** Which side of the van an item sits against. */
type AcrossAnchor = 'left' | 'right' | 'centre' | 'fill'

/**
 * What an item stands on.
 *
 * `floor` and `arches` items take their place in the run. `worktop` and
 * `overhead` items sit on or above the run instead, positioned by their own
 * offset — a hob belongs on the counter, not in the queue beside it.
 */
type HeightAnchor = 'floor' | 'arches' | 'worktop' | 'overhead' | 'roof'

interface TemplateItem {
  slug: string
  along: AlongAnchor
  across: AcrossAnchor
  height: HeightAnchor
  /** For worktop/overhead items: distance from the run's anchored end. */
  alongOffset?: Mm
  /** Distance in from the wall. */
  acrossOffset?: Mm
  /** Override the catalog size, e.g. a shallower galley in a small van. */
  size?: Partial<{ w: Mm; d: Mm; h: Mm }>
  /**
   * Explicit height off the floor, overriding the anchor.
   *
   * For layouts whose whole point is the height — a gear hauler raises the bed
   * well above the arches so the garage underneath will take a bike.
   */
  raisedTo?: Mm
  name?: string
  yaw?: number
}

export interface Template {
  id: string
  name: string
  description: string
  suitedTo: string
  items: TemplateItem[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'weekender',
    name: 'Weekender',
    description:
      'Bed across the back on the arches, a compact galley down one side, and the aisle left clear. The simplest thing that works for two people and a long weekend.',
    suitedTo: 'Weekends and holidays, two people',
    items: [
      { slug: 'fixed-bed-transverse', along: 'rear', across: 'fill', height: 'arches', name: 'Bed platform' },

      // Left run, front to back.
      { slug: 'galley-unit', along: 'front', across: 'left', height: 'floor' },
      // Quarter-turned so the door opens into the aisle rather than into the
      // counter it sits next to.
      { slug: 'compressor-fridge', along: 'front', across: 'left', height: 'floor', yaw: 90 },

      // On the counter.
      { slug: 'sink-unit', along: 'front', across: 'left', height: 'worktop', alongOffset: 150, acrossOffset: 80 },
      { slug: 'two-burner-hob', along: 'front', across: 'left', height: 'worktop', alongOffset: 650, acrossOffset: 60 },

      // Services under the bed, between the wheel arches — which is both where
      // the space is and where the weight wants to be, over the wheelbase.
      { slug: 'fresh-tank-60', along: 'rear', across: 'centre', height: 'floor' },
      { slug: 'water-pump', along: 'rear', across: 'centre', height: 'floor' },
      { slug: 'leisure-battery-100', along: 'rear', across: 'centre', height: 'floor' },

      { slug: 'overhead-locker', along: 'front', across: 'right', height: 'overhead', alongOffset: 300 },
    ],
  },
  {
    id: 'full-time-shower',
    name: 'Full-time with shower',
    description:
      'A wet room behind the galley, bed across the back, and the tankage to support living in it. Wants a long-wheelbase van — in anything shorter the checks will tell you what has to give.',
    suitedTo: 'Living in it, one or two people',
    items: [
      { slug: 'fixed-bed-transverse', along: 'rear', across: 'fill', height: 'arches', name: 'Bed platform' },

      // Left run: kitchen up front, fridge at the end of the counter.
      { slug: 'galley-unit', along: 'front', across: 'left', height: 'floor' },
      { slug: 'compressor-fridge', along: 'front', across: 'left', height: 'floor', yaw: 90 },
      { slug: 'sink-unit', along: 'front', across: 'left', height: 'worktop', alongOffset: 150, acrossOffset: 80 },
      { slug: 'two-burner-hob', along: 'front', across: 'left', height: 'worktop', alongOffset: 700, acrossOffset: 60 },

      // Right run: wet room, then services.
      { slug: 'shower-tray', along: 'front', across: 'right', height: 'floor', name: 'Wet room' },
      { slug: 'wardrobe', along: 'front', across: 'right', height: 'floor', yaw: 270 },

      // Under the bed and between the arches: the only floor in the back half
      // that is actually clear, and the right place for the heavy items anyway.
      { slug: 'fresh-tank-100', along: 'rear', across: 'centre', height: 'floor' },
      { slug: 'water-pump', along: 'rear', across: 'centre', height: 'floor' },
      { slug: 'grey-tank-40', along: 'rear', across: 'centre', height: 'floor' },
      { slug: 'water-heater', along: 'rear', across: 'centre', height: 'floor' },
      { slug: 'leisure-battery-100', along: 'rear', across: 'centre', height: 'floor' },

      { slug: 'roof-fan', along: 'front', across: 'centre', height: 'roof', alongOffset: 1200 },
    ],
  },
  {
    id: 'gear-hauler',
    name: 'Gear hauler',
    description:
      'Most of the floor left empty for bikes, boards or tools, with a raised bed at the back and a garage under it. Minimal fixed kitchen.',
    suitedTo: 'Weekends built around the gear, not the van',
    items: [
      // The bed goes high deliberately: the garage beneath is the reason for
      // this layout, and it has to swallow a bike. Sitting headroom over the bed
      // suffers for it, which the checks will say — that is the actual trade.
      { slug: 'fixed-bed-transverse', along: 'rear', across: 'fill', height: 'arches', raisedTo: 850, name: 'Raised bed' },
      { slug: 'garage-storage', along: 'rear', across: 'fill', height: 'floor', size: { h: 800 }, name: 'Gear garage' },

      // One short galley run and nothing else in the way.
      { slug: 'galley-unit', along: 'front', across: 'left', height: 'floor', size: { d: 800 } },
      { slug: 'two-burner-hob', along: 'front', across: 'left', height: 'worktop', alongOffset: 150, acrossOffset: 60 },
      { slug: 'compressor-fridge', along: 'front', across: 'left', height: 'floor', yaw: 90 },

      { slug: 'fresh-tank-60', along: 'front', across: 'right', height: 'floor' },
      { slug: 'leisure-battery-100', along: 'front', across: 'right', height: 'floor' },
      { slug: 'gear-crate', along: 'front', across: 'right', height: 'floor' },
    ],
  },
]

/** Worktop height, so hobs and sinks land on the counter rather than the floor. */
const WORKTOP_HEIGHT_MM: Mm = 900

/** Height an overhead locker hangs at. */
const OVERHEAD_HEIGHT_MM: Mm = 1350

/** Gap left between a run and the end-anchored items it stops short of. */
const RUN_END_GAP_MM: Mm = 50

/**
 * Bed platform height when a van has no recorded wheel arches.
 *
 * "On the arches" really means "raised, with storage under it", and a custom
 * project has no arches to measure from. Falling through to floor level would
 * drop the bed on top of the tanks that are supposed to live beneath it.
 */
const DEFAULT_PLATFORM_HEIGHT_MM: Mm = 350

function heightOf(anchor: HeightAnchor, archTop: Mm, interiorHeight: Mm, itemHeight: Mm): Mm {
  if (anchor === 'floor') return 0
  if (anchor === 'arches') return archTop > 0 ? archTop : DEFAULT_PLATFORM_HEIGHT_MM
  if (anchor === 'worktop') return WORKTOP_HEIGHT_MM
  // Roof-mounted: recessed into the ceiling, not hanging at head height. A fan
  // parked mid-air reads to the rules as something you would walk into.
  if (anchor === 'roof') return Math.max(0, interiorHeight - itemHeight)
  return OVERHEAD_HEIGHT_MM
}

/** Whether an item takes its turn in the run or sits on top of it. */
function isInRun(item: TemplateItem): boolean {
  return item.height === 'floor' || item.height === 'arches'
}

/**
 * Turn a template into objects for a specific van.
 *
 * End-anchored items are placed first so the runs know where to stop.
 */
export function instantiateTemplate(
  template: Template,
  van: ResolvedVan,
  projectId: string,
): VanObject[] {
  const wheelWells = van.obstacles.filter((obstacle) => obstacle.kind === 'wheel_well')
  const archTop = Math.max(0, ...wheelWells.map((well) => well.position.z + well.size.h))

  /**
   * Where the back of the van effectively ends.
   *
   * Anchoring to the raw interior depth parks the bed and the tanks in the rear
   * doorway, which the checks then — correctly — complain about. Real builds
   * stop short of the doors, so the templates do too.
   */
  const rearAperture = van.obstacles.find((obstacle) => obstacle.kind === 'aperture_rear')
  const rearLine = rearAperture
    ? Math.min(van.interior.d, rearAperture.position.y)
    : van.interior.d

  const resolved = template.items.map((item) => {
    const catalog = catalogItem(item.slug)
    if (!catalog) return null

    const declared = { h: item.size?.h ?? catalog.size.h }
    const z = item.raisedTo ?? heightOf(item.height, archTop, van.interior.h, declared.h)
    const size = {
      w: item.size?.w ?? catalog.size.w,
      d: item.size?.d ?? catalog.size.d,
      h: item.size?.h ?? catalog.size.h,
    }

    const walls = narrowestXRangeBetween(z, z + size.h, van.interior.w, van.taper)
    if (item.across === 'fill') size.w = Math.min(size.w, walls.max - walls.min)

    // A rotated object presents its depth across the van and its width along it,
    // so both the wall placement and the run advance have to use the rotated
    // extent rather than the declared size.
    const quarterTurned = Math.abs((item.yaw ?? 0) % 180) === 90
    const extent = {
      across: quarterTurned ? size.d : size.w,
      along: quarterTurned ? size.w : size.d,
    }

    return { item, catalog, size, z, walls, extent }
  })

  type Resolved = NonNullable<(typeof resolved)[number]>
  const items = resolved.filter((entry): entry is Resolved => entry !== null)

  // Where the front and rear runs have to stop, set by the full-width items.
  let frontLimit = rearLine
  let rearLimit = 0

  for (const { item, extent } of items) {
    if (item.across !== 'fill') continue
    if (item.along === 'rear') {
      frontLimit = Math.min(frontLimit, rearLine - extent.along - RUN_END_GAP_MM)
    } else {
      rearLimit = Math.max(rearLimit, extent.along + RUN_END_GAP_MM)
    }
  }

  // How far each run has advanced from its anchored end.
  const runOffsets = new Map<string, Mm>()
  const objects: VanObject[] = []

  items.forEach(({ item, catalog, size, z, walls, extent }, index) => {
    const usable = walls.max - walls.min
    const acrossOffset = item.acrossOffset ?? 0

    // Placement works on the object's centre, because rotation is about the
    // footprint centre; the stored position is then the unrotated min corner.
    const centreX =
      item.across === 'right'
        ? walls.max - extent.across / 2 - acrossOffset
        : item.across === 'centre'
          ? walls.min + usable / 2 + acrossOffset
          : walls.min + extent.across / 2 + acrossOffset

    const runKey = `${item.along}:${item.across}`
    let centreY: Mm

    if (isInRun(item) && item.across !== 'fill') {
      const advanced = runOffsets.get(runKey) ?? 0
      centreY =
        item.along === 'rear'
          ? rearLine - advanced - extent.along / 2
          : advanced + extent.along / 2
      runOffsets.set(runKey, advanced + extent.along)
    } else {
      const offset = item.alongOffset ?? 0
      centreY =
        item.along === 'rear'
          ? rearLine - offset - extent.along / 2
          : offset + extent.along / 2
    }

    // Keep runs clear of the end-anchored items rather than running into them.
    if (item.across !== 'fill') {
      if (item.along === 'front') {
        centreY = Math.min(centreY, Math.max(extent.along / 2, frontLimit - extent.along / 2))
      } else {
        centreY = Math.max(centreY, rearLimit + extent.along / 2)
      }
    }

    const position = {
      x: Math.round(Math.max(0, centreX - size.w / 2)),
      y: Math.round(Math.max(0, centreY - size.d / 2)),
      z: Math.round(z),
    }

    objects.push(toObject(catalog, projectId, position, size, item, index))
  })

  return objects
}

function toObject(
  catalog: CatalogItem,
  projectId: string,
  position: { x: Mm; y: Mm; z: Mm },
  size: { w: Mm; d: Mm; h: Mm },
  item: TemplateItem,
  index: number,
): VanObject {
  const yaw = item.yaw ?? 0

  return {
    id: crypto.randomUUID(),
    projectId,
    name: item.name ?? catalog.name,
    category: catalog.category,
    kind: catalog.kind,
    position,
    size,
    yaw,
    mass: catalog.mass,
    cost: catalog.cost,
    color: catalog.color,
    articulation: catalog.articulationTemplate
      ? articulationFromTemplate(catalog.articulationTemplate, position, size, yaw)
      : null,
    connections: [],
    zIndex: index,
    notes: null,
    // Template pieces are ordinary catalog items, so resizing one makes it
    // custom in exactly the same way as one placed by hand.
    catalogSlug: catalog.slug,
  }
}

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id)
}
