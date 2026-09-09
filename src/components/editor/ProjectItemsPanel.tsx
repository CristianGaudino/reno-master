/**
 * Everything in this project, as a list.
 *
 * The canvas answers "where is it"; this answers "what have I got, and what does
 * it weigh". It is also where a custom piece is visible whether or not the user
 * ever saved it to their own catalog — an edited piece belongs to the project
 * from the moment it is edited, and should never quietly disappear because it
 * was not filed anywhere.
 */

import { useMemo } from 'react'
import { CATEGORY_LABELS } from '../../lib/constants'
import type { UnitSystem, VanObject } from '../../lib/definitions'
import { describeOrigin, pieceOrigin } from '../../lib/customPieces'
import { formatLength, formatMass } from '../../lib/units'
import { cn } from '../../lib/cn'
import { EmptyState, Panel } from '../ui'
import { useEditorStore } from '../../store/editorStore'

export function ProjectItemsPanel({
  unitSystem,
  className,
}: {
  unitSystem: UnitSystem
  className?: string
}) {
  const objects = useEditorStore((state) => state.objects)
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const select = useEditorStore((state) => state.select)

  // Heaviest first: weight is the thing people get wrong, so the list should
  // put the items that matter at the top rather than in insertion order.
  const sorted = useMemo(
    () => [...objects].sort((a, b) => b.mass - a.mass),
    [objects],
  )

  const totalMass = objects.reduce((sum, object) => sum + object.mass, 0)
  const customCount = objects.filter((object) => pieceOrigin(object).isCustom).length

  if (objects.length === 0) {
    return (
      <Panel title="Items" className={className}>
        <EmptyState title="Nothing placed yet">
          Add pieces from the catalog, or start from a template.
        </EmptyState>
      </Panel>
    )
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Items
          <span className="text-[0.6875rem] font-normal text-ink-faint">
            {objects.length} · {formatMass(totalMass, unitSystem)}
            {customCount > 0 && ` · ${customCount} custom`}
          </span>
        </span>
      }
      className={className}
    >
      <ul className="divide-y divide-border">
        {sorted.map((object) => (
          <ItemRow
            key={object.id}
            object={object}
            unitSystem={unitSystem}
            selected={selectedIds.includes(object.id)}
            onSelect={() => select([object.id])}
          />
        ))}
      </ul>
    </Panel>
  )
}

function ItemRow({
  object,
  unitSystem,
  selected,
  onSelect,
}: {
  object: VanObject
  unitSystem: UnitSystem
  selected: boolean
  onSelect(): void
}) {
  const { original, isCustom } = pieceOrigin(object)

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors',
          selected ? 'bg-accent-soft' : 'hover:bg-surface-sunken',
        )}
      >
        <span
          aria-hidden
          className="mt-1 size-3 shrink-0 rounded-sm"
          style={{ background: object.color }}
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm leading-tight font-medium text-ink">
              {object.name}
            </span>
            {isCustom && (
              <span
                title={describeOrigin(object) ?? undefined}
                className="shrink-0 rounded bg-surface-sunken px-1 text-[0.625rem] text-ink-muted"
              >
                custom
              </span>
            )}
          </span>

          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {formatLength(object.size.w, unitSystem)} ×{' '}
            {formatLength(object.size.d, unitSystem)} ×{' '}
            {formatLength(object.size.h, unitSystem)}
            {object.mass > 0 && ` · ${formatMass(object.mass, unitSystem)}`}
          </span>

          <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-faint">
            {CATEGORY_LABELS[object.category]}
            {isCustom && original && ` · based on ${original.name}`}
          </span>
        </span>
      </button>
    </li>
  )
}
