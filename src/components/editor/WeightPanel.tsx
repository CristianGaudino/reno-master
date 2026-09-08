/**
 * Weight and axle load.
 *
 * Overloading is a safety and legal problem, and it is invisible until a
 * weighbridge tells you — so the numbers get their own always-visible panel
 * rather than only appearing as a warning once you are already over.
 */

import { useMemo } from 'react'
import type { UnitSystem } from '../../lib/definitions'
import { buildContext } from '../../lib/rules'
import { summariseLoad } from '../../lib/rules/weight/load'
import { formatMass } from '../../lib/units'
import { cn } from '../../lib/cn'
import { Panel } from '../ui'
import { useEditorStore } from '../../store/editorStore'

export function WeightPanel({
  unitSystem,
  className,
}: {
  unitSystem: UnitSystem
  className?: string
}) {
  const van = useEditorStore((state) => state.van)
  const objects = useEditorStore((state) => state.objects)
  const settings = useEditorStore((state) => state.settings)

  const load = useMemo(() => {
    if (!van) return null
    return summariseLoad(buildContext(van, objects, settings))
  }, [van, objects, settings])

  if (!van || !load) return null

  const usedFraction = load.payload > 0 ? load.total / load.payload : 0
  const remaining = load.payload - load.total

  return (
    <Panel title="Weight" className={className} bodyClassName="p-3 space-y-3">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-ink">{formatMass(load.total, unitSystem)}</span>
          <span className="text-xs text-ink-muted">
            of {formatMass(load.payload, unitSystem)} payload
          </span>
        </div>

        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              usedFraction > 1
                ? 'bg-danger'
                : usedFraction > 0.8
                  ? 'bg-warn'
                  : 'bg-[var(--color-good)]',
            )}
            style={{ width: `${Math.min(100, usedFraction * 100)}%` }}
          />
        </div>

        <p
          className={cn(
            'mt-1 text-xs',
            remaining < 0 ? 'font-medium text-danger' : 'text-ink-muted',
          )}
        >
          {remaining < 0
            ? `${formatMass(-remaining, unitSystem)} over payload`
            : `${formatMass(remaining, unitSystem)} left for water, gear and passengers`}
        </p>
      </div>

      {van.rearAxleY > van.frontAxleY && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <AxleRow
            label="Front axle"
            mass={load.frontAxle}
            capacity={load.frontCapacity}
            unitSystem={unitSystem}
          />
          <AxleRow
            label="Rear axle"
            mass={load.rearAxle}
            capacity={load.rearCapacity}
            unitSystem={unitSystem}
          />
          <p className="pt-1 text-[0.6875rem] leading-snug text-ink-faint">
            Axle capacities are apportioned from the kerb split, not published
            ratings. Treat these as a prompt to weigh the van, not a measurement.
          </p>
        </div>
      )}
    </Panel>
  )
}

function AxleRow({
  label,
  mass,
  capacity,
  unitSystem,
}: {
  label: string
  mass: number
  capacity: number
  unitSystem: UnitSystem
}) {
  const over = mass > capacity

  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className={cn('tabular-nums', over ? 'font-medium text-danger' : 'text-ink')}>
        {formatMass(mass, unitSystem)}
        <span className="text-ink-faint"> / {formatMass(capacity, unitSystem)}</span>
      </span>
    </div>
  )
}
