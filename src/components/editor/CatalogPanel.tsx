/**
 * The object catalog.
 *
 * Clicking an item drops it into the van at the first free spot rather than
 * requiring a drag: on a phone there is no hover, and a tap-to-place flow works
 * identically on both.
 */

import { useCallback, useMemo, useState } from 'react'
import { CATALOG, catalogItem } from '../../lib/catalog'
import { CATEGORY_LABELS } from '../../lib/constants'
import { OBJECT_CATEGORIES } from '../../lib/definitions'
import type {
  CatalogItem,
  ObjectCategory,
  ResolvedVan,
  UnitSystem,
  VanObject,
  Vec3,
} from '../../lib/definitions'
import { box3From, boxOf, intersects3D, narrowestXRangeBetween } from '../../lib/geometry'
import { formatLength, formatMass } from '../../lib/units'
import { cn } from '../../lib/cn'
import { Panel, TextInput } from '../ui'
import { useDeleteCatalogItem, useUserCatalog } from '../../lib/api/queries'
import { useEditorStore } from '../../store/editorStore'

/** Worktop height, matching the templates' own anchor. */
const WORKTOP_HEIGHT_MM = 900

/** Height an overhead locker hangs at. */
const OVERHEAD_HEIGHT_MM = 1350

export function CatalogPanel({
  unitSystem,
  className,
}: {
  unitSystem: UnitSystem
  className?: string
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ObjectCategory | 'all'>('all')

  const saved = useUserCatalog()
  const deleteSaved = useDeleteCatalogItem()

  /**
   * The user's own pieces, shaped as catalog entries.
   *
   * Placement should not care whether a piece is built in or saved, so they are
   * converted here rather than handled as a special case everywhere.
   *
   * The `slug` deliberately carries the *root* catalog entry rather than the
   * saved piece's own id. Placing a saved piece and then saving that again would
   * otherwise record one saved piece as the origin of the next, and after a
   * couple of rounds a piece could no longer say what it had actually started
   * life as — losing its mounting height and its door along with it.
   */
  const savedAsCatalog: Array<{ id: string; item: CatalogItem }> = useMemo(
    () =>
      (saved.data ?? []).map((piece) => {
        const base = piece.basedOnSlug ? catalogItem(piece.basedOnSlug) : undefined
        return {
          id: piece.id,
          item: {
            // Falls back to a synthetic slug for a piece built from scratch,
            // which genuinely has no catalog ancestor.
            slug: base?.slug ?? `saved:${piece.id}`,
            name: piece.name,
            category: piece.category,
            kind: piece.kind,
            size: piece.size,
            mass: piece.mass,
            cost: piece.cost,
            color: piece.color,
            ...(base?.articulationTemplate
              ? { articulationTemplate: base.articulationTemplate }
              : {}),
            ...(base?.mount ? { mount: base.mount } : {}),
            ...(base?.resizable !== undefined ? { resizable: base.resizable } : {}),
            ...(base?.massModel ? { massModel: base.massModel } : {}),
          },
        }
      }),
    [saved.data],
  )

  const matches = useCallback(
    (item: CatalogItem) => {
      const needle = search.trim().toLowerCase()
      if (category !== 'all' && item.category !== category) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        item.category.includes(needle) ||
        (item.description?.toLowerCase().includes(needle) ?? false)
      )
    },
    [search, category],
  )

  const filtered = useMemo(() => CATALOG.filter(matches), [matches])
  const filteredSaved = useMemo(
    () => savedAsCatalog.filter((entry) => matches(entry.item)),
    [savedAsCatalog, matches],
  )

  /**
   * Read the scene straight from the store rather than from this render's
   * props.
   *
   * Placing several items in quick succession was landing them on top of each
   * other: the second click could still be holding the object list from before
   * the first one was added, so the collision search had nothing to avoid.
   */
  const place = (item: CatalogItem) => {
    const state = useEditorStore.getState()
    if (!state.van) return
    state.addFromCatalog(item, findFreeSpot(item, state.van, state.objects))
  }

  return (
    <Panel title="Catalog" className={className} bodyClassName="flex flex-col">
      <div className="space-y-2 border-b border-border p-2">
        <TextInput
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <CategoryChip
            active={category === 'all'}
            onClick={() => setCategory('all')}
            label="All"
          />
          {OBJECT_CATEGORIES.map((option) => (
            <CategoryChip
              key={option}
              active={category === option}
              onClick={() => setCategory(option)}
              label={CATEGORY_LABELS[option]}
            />
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {filteredSaved.length > 0 && (
          <li className="bg-surface-sunken px-3 py-1.5 text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase">
            Your pieces
          </li>
        )}
        {filteredSaved.map(({ id, item }) => (
          <li key={id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => place(item)}
              className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className="mt-1 size-3 shrink-0 rounded-sm"
                style={{ background: item.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium text-ink">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {formatLength(item.size.w, unitSystem)} ×{' '}
                  {formatLength(item.size.d, unitSystem)} ×{' '}
                  {formatLength(item.size.h, unitSystem)} · {formatMass(item.mass, unitSystem)}
                </span>
              </span>
            </button>
            <button
              type="button"
              title="Remove from your pieces"
              onClick={() => deleteSaved.mutate(id)}
              className="shrink-0 px-2 text-xs text-ink-faint hover:text-danger"
            >
              ✕
            </button>
          </li>
        ))}

        {filteredSaved.length > 0 && (
          <li className="bg-surface-sunken px-3 py-1.5 text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase">
            Catalog
          </li>
        )}

        {filtered.map((item) => (
          <li key={item.slug}>
            <button
              type="button"
              onClick={() => place(item)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className="mt-1 size-3 shrink-0 rounded-sm"
                style={{ background: item.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium text-ink">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {formatLength(item.size.w, unitSystem)} ×{' '}
                  {formatLength(item.size.d, unitSystem)} ×{' '}
                  {formatLength(item.size.h, unitSystem)} · {formatMass(item.mass, unitSystem)}
                </span>
                {item.kind !== 'fixed' && (
                  <span className="mt-1 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] text-ink-muted">
                    {item.kind === 'articulated' ? 'Opens / swings' : 'Loose'}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick(): void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors',
        active
          ? 'bg-accent text-white'
          : 'bg-surface-sunken text-ink-muted hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}

/**
 * Find somewhere the new object actually fits.
 *
 * Dropping everything at the origin buries new items under the bed and makes the
 * catalog feel broken. This walks the floor on a coarse grid and takes the first
 * clear spot.
 *
 * The search is bounded by the *tapered* wall line across the object's own
 * height, not the nominal interior width — placing something at x=0 in a van
 * whose walls lean in at floor level would raise an out-of-bounds error the
 * instant it appeared, which reads as the tool being broken rather than as the
 * real constraint it is.
 */
function findFreeSpot(item: CatalogItem, van: ResolvedVan, objects: VanObject[]): Vec3 {
  const step = 100

  const wheelWells = van.obstacles.filter((obstacle) => obstacle.kind === 'wheel_well')
  // Arches, pillars and doorways are all worth designing around, so placement
  // avoids them rather than dropping something in and reporting it as an error.
  const AVOID: ReadonlyArray<string> = [
    'wheel_well',
    'b_pillar',
    'intrusion',
    'aperture_side',
    'aperture_rear',
  ]
  const solids = [
    ...objects.map(boxOf),
    ...van.obstacles.filter((obstacle) => AVOID.includes(obstacle.kind)).map(boxOf),
  ]

  const archTop = Math.max(0, ...wheelWells.map((well) => well.position.z + well.size.h))

  /**
   * How much clear floor width there is between the wheel arches.
   *
   * This single number decides where a thing can live. Anything wider than it
   * cannot sit on the floor anywhere the arches reach — which, in a van, is most
   * of the back half.
   */
  const interArchWidth = clearWidthBetweenArches(wheelWells, van.interior.w)

  /**
   * Passes to try, in order.
   *
   * An item wider than the gap between the arches gets offered the top of the
   * arches at the *back* of the van first. That is not a trick to dodge the
   * collision check — it is how a transverse bed is actually built, and trying
   * the floor first instead wedges the bed across the middle of the van, which
   * then leaves nowhere for the galley and produces a layout no one would draw.
   *
   * Everything else starts at floor level from the front, which is where
   * cabinets and units genuinely go.
   */
  const mustClearArches = archTop > 0 && item.size.w > interArchWidth
  const passes: Array<{ z: number; fromRear: boolean }> = mustClearArches
    ? [
        { z: archTop, fromRear: true },
        { z: 0, fromRear: false },
      ]
    : [
        { z: 0, fromRear: false },
        { z: archTop, fromRear: false },
      ]

  // Things that mount at a height get offered it first. The floor passes stay
  // as the fallback, so a locker in a van with no room overhead still lands
  // somewhere rather than nowhere.
  const mounted = mountHeight(item, van)
  if (mounted !== null) passes.unshift({ z: mounted, fromRear: false })

  for (const pass of passes) {
    const { z } = pass
    const walls = narrowestXRangeBetween(z, z + item.size.h, van.interior.w, van.taper)
    const left = Math.ceil(walls.min)
    const lastY = van.interior.d - item.size.d

    for (let step_ = 0; step_ * step <= lastY; step_ += 1) {
      const y = pass.fromRear ? lastY - step_ * step : step_ * step
      if (y < 0) break

      for (let x = left; x + item.size.w <= walls.max; x += step) {
        const candidate: Vec3 = { x, y, z }
        const box = box3From(candidate, item.size, 0)

        if (!solids.some((solid) => intersects3D(box, solid).intersecting)) return candidate
      }
    }
  }

  // Genuinely nowhere to put it. Rest it on top of whatever is tallest rather
  // than dropping it inside something — arriving pre-broken reads as a bug,
  // where sitting obviously too high reads as "now move me".
  const highest = objects.reduce(
    (top, object) => Math.max(top, object.position.z + object.size.h),
    0,
  )
  const walls = narrowestXRangeBetween(highest, highest + item.size.h, van.interior.w, van.taper)
  return { x: Math.ceil(walls.min), y: 0, z: highest }
}

/**
 * Clear floor width between the left and right wheel arches.
 *
 * Falls back to the full interior width when a model has no arches recorded,
 * which keeps custom-dimension projects working.
 */
function clearWidthBetweenArches(
  wheelWells: ResolvedVan['obstacles'],
  interiorWidth: number,
): number {
  if (wheelWells.length === 0) return interiorWidth

  const midpoint = interiorWidth / 2
  let leftEdge = 0
  let rightEdge = interiorWidth

  for (const well of wheelWells) {
    const centre = well.position.x + well.size.w / 2
    if (centre < midpoint) {
      leftEdge = Math.max(leftEdge, well.position.x + well.size.w)
    } else {
      rightEdge = Math.min(rightEdge, well.position.x)
    }
  }

  return Math.max(0, rightEdge - leftEdge)
}

/**
 * The height a catalog item mounts at, if it has one.
 *
 * Deliberately the same vocabulary the templates use, so "overhead" means the
 * same thing whether a locker arrives by template or by clicking the catalog.
 */
function mountHeight(item: CatalogItem, van: ResolvedVan): number | null {
  switch (item.mount) {
    case 'worktop':
      return WORKTOP_HEIGHT_MM
    case 'overhead':
      return OVERHEAD_HEIGHT_MM
    case 'roof':
      return Math.max(0, van.interior.h - item.size.h)
    default:
      return null
  }
}
