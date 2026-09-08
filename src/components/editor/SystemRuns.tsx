/**
 * Inferred cable and pipe runs, drawn on the electrical and plumbing layers.
 *
 * Drawn as right-angled dog-legs rather than straight lines, matching how the
 * length is measured — a diagonal would look shorter than the number in the
 * warning beside it, which is exactly the kind of quiet inconsistency that makes
 * people stop believing a tool.
 */

import { LAYER_COLORS } from '../../lib/constants'
import type { RuleLayer, Size3, ViewMode } from '../../lib/definitions'
import { modelPointToView } from '../../lib/geometry'
import { centreOf, type SystemRun } from '../../lib/systems'

export function SystemRuns({
  runs,
  view,
  interior,
  visibleLayers,
  strokeWidth,
}: {
  runs: SystemRun[]
  view: ViewMode
  interior: Size3
  visibleLayers: RuleLayer[]
  strokeWidth: number
}) {
  const shown = runs.filter((run) => visibleLayers.includes(run.layer))
  if (shown.length === 0) return null

  return (
    <g>
      {shown.map((run) => {
        const from = modelPointToView(centreOf(run.from), view, interior)
        const to = modelPointToView(centreOf(run.to), view, interior)
        const colour = LAYER_COLORS[run.layer]

        // Dog-leg: along one axis, then the other. Cable follows the van.
        const corner = { x: from.x, y: to.y }

        return (
          <g key={run.id}>
            <polyline
              points={`${from.x},${from.y} ${corner.x},${corner.y} ${to.x},${to.y}`}
              fill="none"
              stroke={colour}
              strokeWidth={strokeWidth * 2}
              strokeDasharray={`${strokeWidth * 10} ${strokeWidth * 6}`}
              strokeLinejoin="round"
              opacity={0.85}
            />
            <circle cx={from.x} cy={from.y} r={strokeWidth * 4} fill={colour} />
            <circle cx={to.x} cy={to.y} r={strokeWidth * 4} fill={colour} />
          </g>
        )
      })}
    </g>
  )
}

/**
 * Layer visibility toggles.
 *
 * Spec section 1: layers keep the top-down view legible as systems get added.
 */
export function LayerToggles({
  layers,
  visible,
  onToggle,
  showRuns,
  onShowRuns,
  labels,
}: {
  layers: RuleLayer[]
  visible: RuleLayer[]
  onToggle(layer: RuleLayer): void
  showRuns: boolean
  onShowRuns(show: boolean): void
  labels: Record<RuleLayer, string>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {layers.map((layer) => (
        <label key={layer} className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={visible.includes(layer)}
            onChange={() => onToggle(layer)}
            className="size-3.5 accent-[var(--color-accent)]"
          />
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: LAYER_COLORS[layer] }}
          />
          <span className="text-ink-muted">{labels[layer]}</span>
        </label>
      ))}

      <label className="flex cursor-pointer items-center gap-1.5 border-l border-border pl-3 text-xs">
        <input
          type="checkbox"
          checked={showRuns}
          onChange={(event) => onShowRuns(event.target.checked)}
          className="size-3.5 accent-[var(--color-accent)]"
        />
        <span className="text-ink-muted">Runs</span>
      </label>
    </div>
  )
}
