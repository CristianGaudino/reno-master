/**
 * The warnings panel.
 *
 * Errors above warnings, worst breach first. Hovering a finding highlights the
 * objects it names on the canvas, and clicking selects them — a warning you
 * cannot locate is not much use.
 */

import { LAYER_LABELS } from '../../lib/constants'
import type { Finding, RuleReport, UnitSystem } from '../../lib/definitions'
import { formatLength } from '../../lib/units'
import { cn } from '../../lib/cn'
import { EmptyState, Panel } from '../ui'
import { useEditorStore } from '../../store/editorStore'

export function WarningsPanel({
  report,
  unitSystem,
  className,
}: {
  report: RuleReport
  unitSystem: UnitSystem
  className?: string
}) {
  const setHoveredFinding = useEditorStore((state) => state.setHoveredFinding)
  const select = useEditorStore((state) => state.select)
  const visibleLayers = useEditorStore((state) => state.visibleLayers)

  /**
   * Only show findings for layers that are switched on.
   *
   * Spec section 1: a cable-run warning belongs in the electrical view, not in
   * the way while someone is placing a bed.
   */
  const findings = report.findings.filter((finding) => visibleLayers.includes(finding.layer))
  const errorCount = findings.filter((finding) => finding.severity === 'error').length
  const warningCount = findings.length - errorCount
  const hiddenCount = report.findings.length - findings.length

  return (
    <Panel
      className={className}
      title={
        <span className="flex items-center gap-2">
          Checks
          {errorCount > 0 && (
            <span className="rounded bg-danger px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded bg-warn px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
              {warningCount}
            </span>
          )}
        </span>
      }
    >
      {findings.length === 0 ? (
        <EmptyState title="Nothing flagged">
          {hiddenCount > 0
            ? `Nothing on the visible layers. ${hiddenCount} finding${
                hiddenCount === 1 ? ' is' : 's are'
              } on layers you have switched off.`
            : 'Every enabled check passes for this layout.'}
          {report.skipped.length > 0 && ` ${report.skipped.length} check(s) are switched off.`}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {findings.map((finding) => (
            <FindingRow
              key={finding.id}
              finding={finding}
              unitSystem={unitSystem}
              onHover={setHoveredFinding}
              onSelect={select}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function FindingRow({
  finding,
  unitSystem,
  onHover,
  onSelect,
}: {
  finding: Finding
  unitSystem: UnitSystem
  onHover(id: string | null): void
  onSelect(ids: string[]): void
}) {
  const isError = finding.severity === 'error'

  return (
    <li
      className={cn(
        'cursor-pointer px-3 py-2.5 transition-colors',
        isError ? 'hover:bg-danger-soft' : 'hover:bg-warn-soft',
      )}
      onMouseEnter={() => onHover(finding.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(finding.objectIds)}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            isError ? 'bg-danger' : 'bg-warn',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium text-ink">{finding.message}</p>

          {finding.detail && (
            <p className="mt-1 text-xs leading-snug text-ink-muted">{finding.detail}</p>
          )}

          {/*
            The spec's two-part ergonomic message: the 6ft standard is always
            reported, even when it is not the user's own height, because the
            designer is not the only person who will ever use the van.
          */}
          {finding.personas && finding.personas.length > 1 && (
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {finding.personas.map((persona) => (
                <li
                  key={persona.persona}
                  className={cn(
                    'text-xs',
                    persona.passes ? 'text-[var(--color-good)]' : 'text-ink-muted',
                  )}
                >
                  {persona.persona === 'user' ? 'You' : 'Standard'} (
                  {formatLength(persona.heightMm, unitSystem)}):{' '}
                  {persona.passes ? 'fits' : 'tight'}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-1 text-[0.6875rem] text-ink-faint">
            {finding.ruleName} · {LAYER_LABELS[finding.layer]}
          </p>
        </div>
      </div>
    </li>
  )
}
