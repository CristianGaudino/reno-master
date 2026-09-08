/**
 * Settings.
 *
 * Spec section 8: these persist across projects, not per project. Two things
 * matter most — the units everything is displayed in, and the height that
 * calibrates the ergonomic warnings.
 */

import { useSettings, useUpdateSettings } from '../lib/api/queries'
import { RULE_GROUPS } from '../lib/rules'
import { GRID_OPTIONS_MM } from '../lib/config'
import { STANDARD_HEIGHT_MM } from '../lib/constants'
import type { UnitSystem } from '../lib/definitions'
import { formatLength } from '../lib/units'
import {
  NumberField,
  Panel,
  SegmentedControl,
  Select,
  Spinner,
  Toggle,
} from '../components/ui'

export function SettingsPage() {
  const settings = useSettings()
  const update = useUpdateSettings()

  if (settings.isLoading || !settings.data) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-muted">
        <Spinner /> Loading settings…
      </div>
    )
  }

  const current = settings.data
  const unitSystem = current.unitSystem

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <Panel title="Units" bodyClassName="p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink">Measurement system</p>
            <p className="text-xs text-ink-muted">
              Everything is stored in millimetres and converted for display, so
              switching never changes your build.
            </p>
          </div>
          <SegmentedControl<UnitSystem>
            value={unitSystem}
            onChange={(next) => update.mutate({ unitSystem: next })}
            options={[
              { value: 'metric', label: 'Metric' },
              { value: 'imperial', label: 'Imperial' },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Your height" bodyClassName="p-3 space-y-3">
        <p className="text-sm leading-snug text-ink-muted">
          Ergonomic warnings calibrate to your height. They always also report
          against a {formatLength(STANDARD_HEIGHT_MM, unitSystem)} standard,
          whatever you enter here — you will not be the only person who ever uses
          the van.
        </p>

        <div className="flex items-end gap-3">
          <NumberField
            label="Height"
            value={current.heightMm ?? STANDARD_HEIGHT_MM}
            unitSystem={unitSystem}
            min={1200}
            max={2200}
            onChange={(heightMm) => update.mutate({ heightMm })}
            className="w-40"
          />
          {current.heightMm !== null && (
            <button
              type="button"
              onClick={() => update.mutate({ heightMm: null })}
              className="mb-1 text-xs text-ink-muted underline hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        {current.heightMm === null && (
          <p className="text-xs text-ink-faint">
            Not set — warnings currently report against the standard only.
          </p>
        )}
      </Panel>

      <Panel title="Editor" bodyClassName="p-3 space-y-3">
        <Select
          label="Snap grid"
          value={String(current.gridMm)}
          onChange={(value) => update.mutate({ gridMm: Number(value) })}
          options={GRID_OPTIONS_MM.map((grid) => ({
            value: String(grid),
            label: formatLength(grid, unitSystem),
          }))}
          className="w-40"
        />

        <Toggle
          checked={current.snapToObjects}
          onChange={(snapToObjects) => update.mutate({ snapToObjects })}
          label="Snap to walls and other objects"
          description="Aligns edges flush when you drag close to one. Almost everything in a van is built against something else."
        />

        <Toggle
          checked={current.ghostingEnabled}
          onChange={(ghostingEnabled) => update.mutate({ ghostingEnabled })}
          label="Ghost objects above the section cut"
          description="Keeps things visible but faded rather than hiding them, so nothing disappears silently."
        />
      </Panel>

      <Panel title="Checks" bodyClassName="p-3 space-y-4">
        <p className="text-sm leading-snug text-ink-muted">
          Every check can be switched off individually. Hard conflicts are things
          that are objectively wrong; ergonomic warnings depend on who is using
          the van.
        </p>

        {RULE_GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-1">
            <legend className="field-label">{group.title}</legend>
            <p className="mb-1 text-xs text-ink-faint">{group.description}</p>

            {group.rules.map((rule) => (
              <Toggle
                key={rule.id}
                checked={!current.disabledRules.includes(rule.id)}
                onChange={(enabled) => {
                  const disabledRules = enabled
                    ? current.disabledRules.filter((id) => id !== rule.id)
                    : [...current.disabledRules, rule.id]
                  update.mutate({ disabledRules })
                }}
                label={rule.name}
                description={rule.description}
              />
            ))}
          </fieldset>
        ))}
      </Panel>

      <Panel title="Van dimension data" bodyClassName="p-3">
        <p className="text-sm leading-snug text-ink-muted">
          The bundled van presets are assembled from published specs and
          conversion drawings, not measured against physical vehicles. Every one
          is tagged <strong className="text-ink">approximate</strong>, and you can
          correct any dimension inside a project without affecting the shared
          library or anyone else&rsquo;s build.
        </p>
        <p className="mt-2 text-sm leading-snug text-ink-muted">
          Measure your own van before you cut anything.
        </p>
      </Panel>
    </div>
  )
}
