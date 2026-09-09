/**
 * Build a piece that is not in the catalog.
 *
 * Spec section 6: users can add custom objects with specified dimensions. The
 * catalog covers what most vans contain, and every van contains something it
 * does not — a dog crate, a climbing rack, a cabinet someone already owns.
 * Distorting the nearest catalog entry to stand in for those is worse than
 * saying what the thing actually is.
 */

import { useState } from 'react'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/constants'
import { OBJECT_CATEGORIES } from '../../lib/definitions'
import type { ObjectCategory, ObjectKind, UnitSystem } from '../../lib/definitions'
import { massUnitLabel, parseMass } from '../../lib/units'
import { Button, Modal, NumberField, Select, TextInput } from '../ui'
import { useEditorStore } from '../../store/editorStore'

const KIND_OPTIONS: Array<{ value: ObjectKind; label: string }> = [
  { value: 'fixed', label: 'Fixed — bolted down' },
  { value: 'articulated', label: 'Articulated — opens or swings' },
  { value: 'loose', label: 'Loose — movable' },
]

export function NewObjectModal({
  open,
  onClose,
  unitSystem,
}: {
  open: boolean
  onClose(): void
  unitSystem: UnitSystem
}) {
  const addCustomObject = useEditorStore((state) => state.addCustomObject)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<ObjectCategory>('storage')
  const [kind, setKind] = useState<ObjectKind>('fixed')
  const [size, setSize] = useState({ w: 400, d: 400, h: 400 })
  const [mass, setMass] = useState(10_000)

  const reset = () => {
    setName('')
    setCategory('storage')
    setKind('fixed')
    setSize({ w: 400, d: 400, h: 400 })
    setMass(10_000)
  }

  const add = () => {
    addCustomObject({
      name: name.trim() || 'Custom piece',
      category,
      kind,
      position: { x: 0, y: 0, z: 0 },
      size,
      yaw: 0,
      mass,
      cost: 0,
      color: CATEGORY_COLORS[category],
      articulation: null,
      connections: [],
      zIndex: 0,
      notes: null,
      // No catalog ancestor: this is the user's own piece from the outset.
      catalogSlug: null,
    })
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New piece"
      description="Something that is not in the catalog. It goes straight into this project, and you can save it to your pieces afterwards to reuse it."
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={add}>
            Add to van
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          label="Name"
          placeholder="Dog crate"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <Select<ObjectCategory>
            label="Category"
            value={category}
            onChange={setCategory}
            options={OBJECT_CATEGORIES.map((option) => ({
              value: option,
              label: CATEGORY_LABELS[option],
            }))}
          />
          <Select<ObjectKind>
            label="Behaviour"
            value={kind}
            onChange={setKind}
            options={KIND_OPTIONS}
          />
        </div>

        <fieldset>
          <legend className="field-label mb-1">Size</legend>
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Width"
              value={size.w}
              unitSystem={unitSystem}
              min={10}
              onChange={(w) => setSize((current) => ({ ...current, w }))}
            />
            <NumberField
              label="Depth"
              value={size.d}
              unitSystem={unitSystem}
              min={10}
              onChange={(d) => setSize((current) => ({ ...current, d }))}
            />
            <NumberField
              label="Height"
              value={size.h}
              unitSystem={unitSystem}
              min={10}
              onChange={(h) => setSize((current) => ({ ...current, h }))}
            />
          </div>
        </fieldset>

        <label className="flex max-w-40 flex-col gap-1">
          <span className="field-label">Mass ({massUnitLabel(unitSystem)})</span>
          <input
            type="text"
            inputMode="decimal"
            defaultValue={String(Math.round(mass / 1000))}
            onBlur={(event) => {
              const parsed = parseMass(event.target.value, unitSystem)
              if (parsed !== null) setMass(parsed)
            }}
            className="h-8 rounded-md border border-border bg-surface-raised px-2 text-sm"
          />
        </label>

        <p className="text-xs leading-snug text-ink-muted">
          It lands at the front of the van; drag or nudge it into place. Every
          check applies to it exactly as it would to a catalog piece.
        </p>
      </div>
    </Modal>
  )
}
