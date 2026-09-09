/**
 * Correct the van's dimensions for this project.
 *
 * The preset library is a starting point. Once someone has a tape measure
 * against their own van, this is where the real numbers go — and they stay on
 * this project rather than editing the shared library, so one person's
 * measurement of their Sprinter never quietly becomes everyone else's.
 *
 * Every field falls back to the preset until it is overridden, and each one can
 * be put back individually. That matters: someone who measures only the interior
 * width should not have to re-enter everything else to keep it.
 */

import { useState } from 'react'
import type { Mm, ObstacleOverride, UnitSystem, VanObstacle } from '../../lib/definitions'
import { CONFIDENCE_EXPLANATIONS } from '../../lib/constants'
import { formatLength, formatMass, massUnitLabel, parseMass } from '../../lib/units'
import { useVanModels } from '../../lib/api/queries'
import { vanModelLabel } from '../../lib/vans'
import { Button, ConfidenceBadge, Modal, NumberField, Panel, Select } from '../ui'
import { useEditorStore } from '../../store/editorStore'

const OBSTACLE_LABELS: Record<VanObstacle['kind'], string> = {
  wheel_well: 'Wheel arch',
  b_pillar: 'Pillar',
  aperture_side: 'Side doorway',
  aperture_rear: 'Rear doorway',
  mount_point: 'Mounting point',
  intrusion: 'Intrusion',
}

export function VanDimensionsModal({
  open,
  onClose,
  unitSystem,
}: {
  open: boolean
  onClose(): void
  unitSystem: UnitSystem
}) {
  const project = useEditorStore((state) => state.project)
  const vanModel = useEditorStore((state) => state.vanModel)
  const van = useEditorStore((state) => state.van)
  const patchProject = useEditorStore((state) => state.patchProject)

  const [showObstacles, setShowObstacles] = useState(false)
  const vanModels = useVanModels()

  if (!project || !van) return null

  const overrides = project.overrides ?? {}
  const preset = vanModel?.interior ?? project.customInterior ?? van.interior

  const setInterior = (axis: 'w' | 'd' | 'h', value: Mm) => {
    patchProject({
      overrides: { ...overrides, interior: { ...overrides.interior, [axis]: value } },
    })
  }

  const clearInterior = (axis: 'w' | 'd' | 'h') => {
    const next = { ...overrides.interior }
    delete next[axis]
    patchProject({
      overrides: {
        ...overrides,
        ...(Object.keys(next).length > 0 ? { interior: next } : { interior: undefined }),
      },
    })
  }

  const setObstacle = (id: string, patch: ObstacleOverride | null) => {
    patchProject({
      overrides: { ...overrides, obstacles: { ...overrides.obstacles, [id]: patch } },
    })
  }

  const resetAll = () => patchProject({ overrides: {} })

  const overriddenAxes = Object.keys(overrides.interior ?? {}) as Array<'w' | 'd' | 'h'>
  const removedObstacles = Object.values(overrides.obstacles ?? {}).filter(
    (value) => value === null,
  ).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Van dimensions — ${van.label}`}
      description={
        <>
          These stay on this project. Correcting them here never changes the
          shared preset or anyone else&rsquo;s build.
        </>
      }
      footer={
        <>
          {van.hasOverrides && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              Reset everything to the preset
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-sunken px-3 py-2">
          <ConfidenceBadge confidence={van.confidence} note={van.sourceNote} />
          <p className="min-w-0 flex-1 text-xs leading-snug text-ink-muted">
            {CONFIDENCE_EXPLANATIONS[van.confidence]}
          </p>
        </div>

        <Panel title="Van" bodyClassName="p-3 space-y-2">
          <Select
            label="Model"
            value={project.vanModelId ?? 'custom'}
            onChange={(next) =>
              patchProject({
                vanModelId: next === 'custom' ? null : next,
                // Corrections describe the van they were measured on, so they
                // cannot survive a change of vehicle.
                overrides: {},
                ...(next === 'custom' && !project.customInterior
                  ? { customInterior: { ...van.interior } }
                  : {}),
              })
            }
            options={[
              { value: 'custom', label: 'Custom dimensions' },
              ...(vanModels.data ?? []).map((model) => ({
                value: model.id,
                label: vanModelLabel(model),
              })),
            ]}
          />
          <p className="text-[0.6875rem] leading-snug text-ink-faint">
            Changing the van clears any corrections you have made here — they
            described the old one. Your layout stays exactly where it is, and the
            checks will tell you what no longer fits.
          </p>
        </Panel>

        <Panel title="Interior" bodyClassName="p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { axis: 'w', label: 'Width', hint: 'At the widest point' },
                { axis: 'd', label: 'Length', hint: 'Bulkhead to rear doors' },
                { axis: 'h', label: 'Height', hint: 'Floor to ceiling' },
              ] as const
            ).map(({ axis, label, hint }) => (
              <div key={axis}>
                <NumberField
                  label={label}
                  value={van.interior[axis]}
                  unitSystem={unitSystem}
                  min={500}
                  onChange={(value) => setInterior(axis, value)}
                />
                <p className="mt-1 text-[0.6875rem] leading-snug text-ink-faint">
                  {overriddenAxes.includes(axis) ? (
                    <>
                      Preset: {formatLength(preset[axis], unitSystem)}{' '}
                      <button
                        type="button"
                        onClick={() => clearInterior(axis)}
                        className="underline hover:text-ink"
                      >
                        reset
                      </button>
                    </>
                  ) : (
                    hint
                  )}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs leading-snug text-ink-muted">
            These are shell dimensions — bare metal. Insulation, framing and
            lining come off them, which is typically 40&ndash;60mm a side once
            the walls are built.
          </p>
        </Panel>

        <Panel title="Payload" bodyClassName="p-3">
          <label className="flex max-w-xs flex-col gap-1">
            <span className="field-label">
              Available payload ({massUnitLabel(unitSystem)})
            </span>
            <input
              type="text"
              inputMode="decimal"
              key={`payload-${van.payload}-${unitSystem}`}
              defaultValue={formatMass(van.payload, unitSystem, true)}
              onBlur={(event) => {
                const parsed = parseMass(event.target.value, unitSystem)
                if (parsed !== null) patchProject({ overrides: { ...overrides, payload: parsed } })
              }}
              className="h-8 rounded-md border border-border bg-surface-raised px-2 text-sm"
            />
            <span className="text-[0.6875rem] leading-snug text-ink-faint">
              Kerb weight to gross vehicle weight. It is on the VIN plate, and it
              is the number the build, the water and the passengers all share.
            </span>
          </label>
        </Panel>

        {van.obstacles.length > 0 && (
          <Panel
            title="Fixed obstacles"
            actions={
              <Button size="sm" variant="ghost" onClick={() => setShowObstacles((on) => !on)}>
                {showObstacles ? 'Hide' : `Edit ${van.obstacles.length}`}
              </Button>
            }
            bodyClassName="p-3"
          >
            {!showObstacles ? (
              <p className="text-xs leading-snug text-ink-muted">
                Wheel arches, pillars and doorways.
                {removedObstacles > 0 && ` ${removedObstacles} removed on this project.`}{' '}
                Worth correcting if yours differ — a wheel arch in the wrong place
                is the difference between a bed fitting and not.
              </p>
            ) : (
              <ul className="space-y-3">
                {van.obstacles.map((obstacle) => (
                  <ObstacleRow
                    key={obstacle.id}
                    obstacle={obstacle}
                    unitSystem={unitSystem}
                    override={overrides.obstacles?.[obstacle.id] ?? undefined}
                    onChange={(patch) => setObstacle(obstacle.id, patch)}
                    onRemove={() => setObstacle(obstacle.id, null)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </Modal>
  )
}

function ObstacleRow({
  obstacle,
  unitSystem,
  override,
  onChange,
  onRemove,
}: {
  obstacle: VanObstacle
  unitSystem: UnitSystem
  override: ObstacleOverride | undefined
  onChange(patch: ObstacleOverride): void
  onRemove(): void
}) {
  return (
    <li className="rounded-md border border-border p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">
          {obstacle.name}
          <span className="ml-2 text-xs font-normal text-ink-faint">
            {OBSTACLE_LABELS[obstacle.kind]}
          </span>
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          title="Some vans have had a pillar or bulkhead removed"
        >
          Not in my van
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label="Across"
          value={obstacle.position.x}
          unitSystem={unitSystem}
          onChange={(x) =>
            onChange({ ...override, position: { ...override?.position, x } })
          }
        />
        <NumberField
          label="Along"
          value={obstacle.position.y}
          unitSystem={unitSystem}
          onChange={(y) =>
            onChange({ ...override, position: { ...override?.position, y } })
          }
        />
        <NumberField
          label="Height"
          value={obstacle.position.z}
          unitSystem={unitSystem}
          onChange={(z) =>
            onChange({ ...override, position: { ...override?.position, z } })
          }
        />
        <NumberField
          label="Width"
          value={obstacle.size.w}
          unitSystem={unitSystem}
          min={10}
          onChange={(w) => onChange({ ...override, size: { ...override?.size, w } })}
        />
        <NumberField
          label="Depth"
          value={obstacle.size.d}
          unitSystem={unitSystem}
          min={10}
          onChange={(d) => onChange({ ...override, size: { ...override?.size, d } })}
        />
        <NumberField
          label="Tall"
          value={obstacle.size.h}
          unitSystem={unitSystem}
          min={10}
          onChange={(h) => onChange({ ...override, size: { ...override?.size, h } })}
        />
      </div>
    </li>
  )
}
