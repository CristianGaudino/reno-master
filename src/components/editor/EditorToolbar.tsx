/**
 * The editor's top bar: view switching, the section cut, undo/redo and sync
 * status.
 */

import { Link } from 'react-router'
import { VIEW_LABELS } from '../../lib/geometry'
import type { UnitSystem, ViewMode } from '../../lib/definitions'
import { formatLength } from '../../lib/units'
import { cn } from '../../lib/cn'
import { ALL_LAYERS, LAYER_LABELS } from '../../lib/constants'
import { Button, SegmentedControl } from '../ui'
import { useEditorStore } from '../../store/editorStore'
import { LayerToggles } from './SystemRuns'
import { SyncIndicator } from './SyncIndicator'

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'top', label: 'Top' },
  { value: 'side', label: 'Side' },
  { value: 'rear', label: 'Rear' },
]

export function EditorToolbar({ unitSystem }: { unitSystem: UnitSystem }) {
  const project = useEditorStore((state) => state.project)
  const van = useEditorStore((state) => state.van)
  const view = useEditorStore((state) => state.view)
  const setView = useEditorStore((state) => state.setView)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const history = useEditorStore((state) => state.history)

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface-raised px-3 py-2">
      <Link
        to="/projects"
        className="text-sm font-medium text-ink-muted hover:text-ink"
        title="Back to projects"
      >
        ←
      </Link>

      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-ink">
          {project?.name ?? 'Loading…'}
        </h1>
        <p className="truncate text-xs text-ink-muted">{van?.label}</p>
      </div>

      <SegmentedControl
        value={view}
        onChange={setView}
        options={VIEW_OPTIONS}
        className="ml-auto"
      />

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={history.past.length === 0}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={redo}
          disabled={history.future.length === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </Button>
      </div>

      <SyncIndicator />

      <p className="basis-full text-xs text-ink-faint sm:hidden">
        {VIEW_LABELS[view]}
        {view === 'top' && <CutSummary unitSystem={unitSystem} />}
      </p>
    </header>
  )
}

function CutSummary({ unitSystem }: { unitSystem: UnitSystem }) {
  const cutHeight = useEditorStore((state) => state.cutHeight)
  return <> · section at {formatLength(cutHeight, unitSystem)}</>
}

/**
 * The section cut.
 *
 * Sets the height the top-down view is read at: at 300mm you see the bed
 * platform and cabinet bases, at 1400mm the overhead lockers and nothing else.
 * Objects above the cut ghost rather than vanish, so nothing disappears silently.
 */
export function HeightSlider({ unitSystem }: { unitSystem: UnitSystem }) {
  const van = useEditorStore((state) => state.van)
  const cutHeight = useEditorStore((state) => state.cutHeight)
  const setCutHeight = useEditorStore((state) => state.setCutHeight)
  const ghosting = useEditorStore((state) => state.ghostingEnabled)
  const setGhosting = useEditorStore((state) => state.setGhosting)
  const view = useEditorStore((state) => state.view)

  if (!van) return null

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3 py-2',
        view !== 'top' && 'opacity-40',
      )}
    >
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <span className="field-label shrink-0">Section</span>
        <input
          type="range"
          min={0}
          max={van.interior.h}
          step={10}
          value={cutHeight}
          disabled={view !== 'top'}
          onChange={(event) => setCutHeight(Number(event.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink">
          {formatLength(cutHeight, unitSystem)}
        </span>
      </label>

      <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={ghosting}
          onChange={(event) => setGhosting(event.target.checked)}
          className="size-3.5 accent-[var(--color-accent)]"
        />
        Ghost above
      </label>
    </div>
  )
}

/**
 * Layer visibility. Sits beside the section cut because both answer the same
 * question: what am I looking at right now.
 */
export function LayerBar() {
  const visibleLayers = useEditorStore((state) => state.visibleLayers)
  const toggleLayer = useEditorStore((state) => state.toggleLayer)
  const showRuns = useEditorStore((state) => state.showRuns)
  const setShowRuns = useEditorStore((state) => state.setShowRuns)

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3 py-1.5">
      <span className="field-label shrink-0">Layers</span>
      <LayerToggles
        layers={ALL_LAYERS}
        visible={visibleLayers}
        onToggle={toggleLayer}
        showRuns={showRuns}
        onShowRuns={setShowRuns}
        labels={LAYER_LABELS}
      />
    </div>
  )
}
