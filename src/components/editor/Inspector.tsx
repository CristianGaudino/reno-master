/**
 * Properties of the selected object.
 *
 * Numeric entry matters as much as dragging: most real dimensions come off a
 * tape measure or a spec sheet, and typing 1832 is more precise than any drag.
 */

import type { ObjectKind, UnitSystem, VanObject } from '../../lib/definitions'
import { CATEGORY_LABELS } from '../../lib/constants'
import { OBJECT_CATEGORIES } from '../../lib/definitions'
import { formatMass, massUnitLabel, parseMass } from '../../lib/units'
import { Button, EmptyState, NumberField, Panel, Select, TextInput } from '../ui'
import { useEditorStore } from '../../store/editorStore'

const KIND_OPTIONS: Array<{ value: ObjectKind; label: string }> = [
  { value: 'fixed', label: 'Fixed — bolted down' },
  { value: 'articulated', label: 'Articulated — opens or swings' },
  { value: 'loose', label: 'Loose — movable' },
]

export function Inspector({
  unitSystem,
  className,
}: {
  unitSystem: UnitSystem
  className?: string
}) {
  const objects = useEditorStore((state) => state.objects)
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const van = useEditorStore((state) => state.van)
  const patchObjects = useEditorStore((state) => state.patchObjects)
  const placeObjects = useEditorStore((state) => state.placeObjects)
  const resizeObject = useEditorStore((state) => state.resizeObject)
  const rotateObject = useEditorStore((state) => state.rotateObject)
  const deleteObjects = useEditorStore((state) => state.deleteObjects)
  const duplicateObjects = useEditorStore((state) => state.duplicateObjects)

  const selected = objects.filter((object) => selectedIds.includes(object.id))

  if (selected.length === 0) {
    return (
      <Panel title="Properties" className={className}>
        <EmptyState title="Nothing selected">
          Pick an object on the canvas to edit its dimensions, weight and position.
        </EmptyState>
      </Panel>
    )
  }

  if (selected.length > 1) {
    return (
      <Panel title={`${selected.length} selected`} className={className} bodyClassName="p-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => duplicateObjects(selectedIds)}>
            Duplicate
          </Button>
          <Button size="sm" variant="danger" onClick={() => deleteObjects(selectedIds)}>
            Delete
          </Button>
        </div>
      </Panel>
    )
  }

  const object = selected[0]!
  const patch = (changes: Partial<VanObject>) => patchObjects([object.id], () => changes)

  return (
    <Panel title="Properties" className={className} bodyClassName="space-y-4 p-3">
      <TextInput
        label="Name"
        value={object.name}
        onChange={(event) => patch({ name: event.target.value })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Category"
          value={object.category}
          onChange={(category) => patch({ category })}
          options={OBJECT_CATEGORIES.map((category) => ({
            value: category,
            label: CATEGORY_LABELS[category],
          }))}
        />
        <Select
          label="Behaviour"
          value={object.kind}
          onChange={(kind) => patch({ kind })}
          options={KIND_OPTIONS}
        />
      </div>

      {object.kind === 'loose' && (
        <p className="rounded-md bg-surface-sunken px-2.5 py-2 text-xs leading-snug text-ink-muted">
          Loose objects are skipped by clearance and walkway checks, but still
          count toward weight and axle load.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="field-label mb-1">Size</legend>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Width"
            value={object.size.w}
            unitSystem={unitSystem}
            min={10}
            onChange={(w) => resizeObject(object.id, { w })}
          />
          <NumberField
            label="Depth"
            value={object.size.d}
            unitSystem={unitSystem}
            min={10}
            onChange={(d) => resizeObject(object.id, { d })}
          />
          <NumberField
            label="Height"
            value={object.size.h}
            unitSystem={unitSystem}
            min={10}
            onChange={(h) => resizeObject(object.id, { h })}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="field-label mb-1">Position</legend>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Across"
            value={object.position.x}
            unitSystem={unitSystem}
            onChange={(x) => placeObjects([{ id: object.id, position: { ...object.position, x } }])}
          />
          <NumberField
            label="Along"
            value={object.position.y}
            unitSystem={unitSystem}
            onChange={(y) => placeObjects([{ id: object.id, position: { ...object.position, y } }])}
          />
          <NumberField
            label="Height"
            value={object.position.z}
            unitSystem={unitSystem}
            max={van?.interior.h}
            onChange={(z) => placeObjects([{ id: object.id, position: { ...object.position, z } }])}
          />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="field-label">Rotation</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={Math.round(object.yaw) % 360}
            onChange={(event) => rotateObject(object.id, Number(event.target.value))}
            className="min-w-0 flex-1 accent-[var(--color-accent)]"
          />
          <span className="w-12 text-right text-sm tabular-nums text-ink">
            {Math.round(object.yaw) % 360}°
          </span>
        </div>
        <div className="mt-1 flex gap-1">
          {[0, 90, 180, 270].map((angle) => (
            <Button
              key={angle}
              size="sm"
              variant="ghost"
              onClick={() => rotateObject(object.id, angle)}
            >
              {angle}°
            </Button>
          ))}
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className="field-label">Mass ({massUnitLabel(unitSystem)})</span>
        <input
          type="text"
          inputMode="decimal"
          defaultValue={formatMass(object.mass, unitSystem, true)}
          key={`${object.id}-${object.mass}-${unitSystem}`}
          onBlur={(event) => {
            const parsed = parseMass(event.target.value, unitSystem)
            if (parsed !== null) patch({ mass: parsed })
          }}
          className="h-8 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
        />
      </label>

      {object.articulation && (
        <div className="rounded-md bg-surface-sunken p-2.5">
          <p className="field-label mb-2">Swing</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Leaf length"
              value={object.articulation.leafLength}
              unitSystem={unitSystem}
              min={50}
              onChange={(leafLength) =>
                patch({
                  articulation: { ...object.articulation!, leafLength },
                })
              }
            />
            <label className="flex flex-col gap-1">
              <span className="field-label">Opens to</span>
              <div className="flex h-8 items-center gap-2">
                <input
                  type="range"
                  min={15}
                  max={270}
                  step={5}
                  value={Math.abs(object.articulation.sweepAngle)}
                  onChange={(event) =>
                    patch({
                      articulation: {
                        ...object.articulation!,
                        sweepAngle:
                          Number(event.target.value) *
                          Math.sign(object.articulation!.sweepAngle || 1),
                      },
                    })
                  }
                  className="min-w-0 flex-1 accent-[var(--color-accent)]"
                />
                <span className="w-10 text-right text-sm tabular-nums">
                  {Math.abs(Math.round(object.articulation.sweepAngle))}°
                </span>
              </div>
            </label>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() =>
              patch({
                articulation: {
                  ...object.articulation!,
                  sweepAngle: -object.articulation!.sweepAngle,
                },
              })
            }
          >
            Flip swing direction
          </Button>
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={() => duplicateObjects([object.id])}>
          Duplicate
        </Button>
        <Button size="sm" variant="danger" onClick={() => deleteObjects([object.id])}>
          Delete
        </Button>
      </div>
    </Panel>
  )
}
