/**
 * The editor canvas.
 *
 * One component serves all three views: everything spatial goes through
 * `projectObject` / `viewDeltaToModel`, so a drag in the side elevation writes
 * the same record the floor plan reads.
 *
 * Drag handling deliberately writes to the store on every move rather than
 * buffering until pointerup. That is what makes warnings update live as you
 * push a cabinet toward a bed, which is the whole point of the tool; at van
 * scale the rule pass costs a fraction of a frame.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { HANDLE_SIZE_PX } from '../../lib/config'
import type { Finding, Size3, Vec3 } from '../../lib/definitions'
import {
  interiorRect,
  projectObject,
  viewDeltaToModel,
  viewPositionAxes,
  viewSizeAxes,
} from '../../lib/geometry'
import { snapPosition } from '../../lib/snapping'
import { useEditorStore } from '../../store/editorStore'
import { useViewport } from '../../hooks/useViewport'
import { VIEW_LABELS } from '../../lib/geometry'
import { layerOf, inferRuns } from '../../lib/systems'
import { ObjectShape } from './ObjectShape'
import { SystemRuns } from './SystemRuns'
import { VanShell } from './VanShell'

type DragMode =
  | { kind: 'none' }
  | { kind: 'move'; ids: string[]; startModel: { x: number; y: number }; origins: Map<string, Vec3> }
  | {
      kind: 'resize'
      id: string
      handle: HandleId
      startModel: { x: number; y: number }
      origin: { position: Vec3; size: Size3 }
    }
  | { kind: 'marquee'; start: { x: number; y: number }; current: { x: number; y: number } }

type HandleId = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'

const HANDLES: Array<{ id: HandleId; u: number; v: number; cursor: string }> = [
  { id: 'nw', u: 0, v: 0, cursor: 'nwse-resize' },
  { id: 'n', u: 0.5, v: 0, cursor: 'ns-resize' },
  { id: 'ne', u: 1, v: 0, cursor: 'nesw-resize' },
  { id: 'e', u: 1, v: 0.5, cursor: 'ew-resize' },
  { id: 'se', u: 1, v: 1, cursor: 'nwse-resize' },
  { id: 's', u: 0.5, v: 1, cursor: 'ns-resize' },
  { id: 'sw', u: 0, v: 1, cursor: 'nesw-resize' },
  { id: 'w', u: 0, v: 0.5, cursor: 'ew-resize' },
]

export function Canvas({ findings }: { findings: Finding[] }) {
  const van = useEditorStore((state) => state.van)
  const objects = useEditorStore((state) => state.objects)
  const view = useEditorStore((state) => state.view)
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const cutHeight = useEditorStore((state) => state.cutHeight)
  const ghostingEnabled = useEditorStore((state) => state.ghostingEnabled)
  const settings = useEditorStore((state) => state.settings)
  const hoveredFindingId = useEditorStore((state) => state.hoveredFindingId)
  const visibleLayers = useEditorStore((state) => state.visibleLayers)
  const showRuns = useEditorStore((state) => state.showRuns)

  const select = useEditorStore((state) => state.select)
  const placeObjects = useEditorStore((state) => state.placeObjects)
  const resizeObject = useEditorStore((state) => state.resizeObject)

  const { containerRef, viewport, viewBox, toModel, fitTo, bind } = useViewport()
  const [drag, setDrag] = useState<DragMode>({ kind: 'none' })
  const [guides, setGuides] = useState<Array<{ axis: 'x' | 'y' | 'z'; value: number }>>([])

  // Line weights are specified in screen pixels and converted to model units, so
  // strokes stay a constant thickness at any zoom.
  const strokeWidth = 1 / viewport.scale
  const handleSize = HANDLE_SIZE_PX / viewport.scale

  const interior: Size3 = van?.interior ?? { w: 1, d: 1, h: 1 }

  // Fit the van to the viewport when the view or the vehicle changes.
  useEffect(() => {
    if (!van) return
    fitTo(interiorRect(van.interior, view))
  }, [van, view, fitTo])

  const faultyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const finding of findings) {
      if (finding.severity !== 'error') continue
      for (const id of finding.objectIds) ids.add(id)
    }
    return ids
  }, [findings])

  // Runs are inferred from the scene, so they follow objects as they move.
  const runs = useMemo(() => inferRuns(objects), [objects])

  const flaggedIds = useMemo(() => {
    const finding = findings.find((candidate) => candidate.id === hoveredFindingId)
    return new Set(finding?.objectIds ?? [])
  }, [findings, hoveredFindingId])

  /**
   * Reads the scene from the store rather than from this render.
   *
   * The identity of this callback decides whether the memoised shapes can skip
   * a render. Closing over `objects` and `selectedIds` would give it a new
   * identity on every frame of a drag, re-rendering every object in the van to
   * move one of them.
   */
  const beginMove = useCallback(
    (event: React.PointerEvent, id: string) => {
      if (event.button !== 0 || event.shiftKey) return
      event.stopPropagation()

      const state = useEditorStore.getState()
      const additive = event.metaKey || event.ctrlKey
      const alreadySelected = state.selectedIds.includes(id)
      const ids = additive
        ? alreadySelected
          ? state.selectedIds
          : [...state.selectedIds, id]
        : alreadySelected
          ? state.selectedIds
          : [id]

      if (!alreadySelected || additive) state.select(ids)
      ;(event.currentTarget as Element).setPointerCapture(event.pointerId)

      const origins = new Map<string, Vec3>()
      for (const object of state.objects) {
        if (ids.includes(object.id)) origins.set(object.id, { ...object.position })
      }

      setDrag({ kind: 'move', ids, startModel: toModel(event), origins })
    },
    [toModel],
  )

  const beginResize = useCallback(
    (event: React.PointerEvent, id: string, handle: HandleId) => {
      if (event.button !== 0) return
      event.stopPropagation()
      ;(event.currentTarget as Element).setPointerCapture(event.pointerId)

      const object = useEditorStore
        .getState()
        .objects.find((candidate) => candidate.id === id)
      if (!object) return

      setDrag({
        kind: 'resize',
        id,
        handle,
        startModel: toModel(event),
        origin: { position: { ...object.position }, size: { ...object.size } },
      })
    },
    [toModel],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const current = drag
      if (current.kind === 'none' || !van) return

      const model = toModel(event)

      if (current.kind === 'marquee') {
        setDrag({ ...current, current: model })
        return
      }

      const du = model.x - current.startModel.x
      const dv = model.y - current.startModel.y

      if (current.kind === 'move') {
        const delta = viewDeltaToModel(du, dv, view)
        const primaryId = current.ids[0]
        const primary = objects.find((object) => object.id === primaryId)
        if (!primary) return

        const origin = current.origins.get(primary.id)
        if (!origin) return

        const proposed: Vec3 = {
          x: origin.x + (delta.x ?? 0),
          y: origin.y + (delta.y ?? 0),
          z: origin.z + (delta.z ?? 0),
        }

        // Snap the object under the cursor, then move everything else by the
        // same corrected delta so a multi-selection keeps its relative layout.
        const snapped = snapPosition({
          proposed,
          size: primary.size,
          interior: van.interior,
          objects,
          obstacles: van.obstacles,
          excludeIds: current.ids,
          gridMm: settings.gridMm,
          snapToObjects: settings.snapToObjects,
        })

        setGuides(snapped.guides)

        // The snap may have nudged the primary object; everything else in the
        // selection moves by that same corrected delta so relative layout holds.
        const applied = {
          x: snapped.position.x - origin.x,
          y: snapped.position.y - origin.y,
          z: snapped.position.z - origin.z,
        }

        // Absolute placement computed from the gesture's starting positions, so
        // a snap correction on one frame does not bias the next.
        const placements = [...current.origins.entries()].map(([objectId, start]) => ({
          id: objectId,
          position: {
            x: start.x + applied.x,
            y: start.y + applied.y,
            z: start.z + applied.z,
          },
        }))

        placeObjects(placements, `move:${current.ids.join(',')}`)
        return
      }

      if (current.kind === 'resize') {
        const sizeAxes = viewSizeAxes(view)
        const positionAxes = viewPositionAxes(view)
        const handle = current.handle

        const size: Partial<Size3> = {}
        const position: Partial<Vec3> = {}

        const movesU = handle.includes('e') || handle.includes('w')
        const movesV = handle.includes('n') || handle.includes('s')

        if (movesU) {
          const growing = handle.includes('e')
          const deltaU = growing ? du : -du
          const nextU = Math.max(50, current.origin.size[sizeAxes.u] + deltaU)
          size[sizeAxes.u] = Math.round(nextU / settings.gridMm) * settings.gridMm
          if (!growing) {
            position[positionAxes.u] =
              current.origin.position[positionAxes.u] +
              (current.origin.size[sizeAxes.u] - (size[sizeAxes.u] ?? 0))
          }
        }

        if (movesV) {
          // In the elevations the screen's vertical axis is inverted relative to
          // z, so which handle grows the object flips with it.
          const growingOnScreen = handle.includes('s')
          const deltaV = growingOnScreen ? dv : -dv
          const nextV = Math.max(50, current.origin.size[sizeAxes.v] + deltaV)
          const snappedV = Math.round(nextV / settings.gridMm) * settings.gridMm
          size[sizeAxes.v] = snappedV

          const growsFromMinEdge = view === 'top' ? !growingOnScreen : growingOnScreen
          if (growsFromMinEdge) {
            position[positionAxes.v] =
              current.origin.position[positionAxes.v] +
              (current.origin.size[sizeAxes.v] - snappedV)
          }
        }

        resizeObject(current.id, size, position, `resize:${current.id}`)
      }
    },
    [drag, placeObjects, objects, resizeObject, settings.gridMm, settings.snapToObjects, toModel, van, view],
  )

  const endDrag = useCallback(() => {
    const current = drag

    if (current.kind === 'marquee' && van) {
      const minX = Math.min(current.start.x, current.current.x)
      const maxX = Math.max(current.start.x, current.current.x)
      const minY = Math.min(current.start.y, current.current.y)
      const maxY = Math.max(current.start.y, current.current.y)

      const hit = objects
        .filter((object) => {
          const rect = projectObject(object, view, van.interior).rect
          return (
            rect.x < maxX && rect.x + rect.w > minX && rect.y < maxY && rect.y + rect.h > minY
          )
        })
        .map((object) => object.id)

      select(hit)
    }

    setDrag({ kind: 'none' })
    setGuides([])
    // Clearing the coalesce key ends the undo group, so the next drag is its
    // own history entry.
    useEditorStore.setState({ lastCoalesceKey: undefined })
  }, [drag, objects, select, van, view])

  const onBackgroundPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (bind.onPointerDown(event)) return
      if (event.button !== 0) return

      const model = toModel(event)
      select([])
      setDrag({ kind: 'marquee', start: model, current: model })
      ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    },
    [bind, select, toModel],
  )

  if (!van) return <div ref={containerRef} className="min-h-0 flex-1" />

  const bounds = interiorRect(van.interior, view)

  // Hidden layers are dropped entirely rather than dimmed: the point of a layer
  // toggle is to get things out of the way.
  const sorted = [...objects]
    .filter((object) => visibleLayers.includes(layerOf(object)))
    .sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 bg-surface-sunken">
      <svg
        className="editor-canvas absolute inset-0 size-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        viewBox={viewBox}
        // Focusable and described, so the canvas is reachable and its contents
        // are announced rather than being an opaque rectangle.
        tabIndex={0}
        role="application"
        aria-label={`${VIEW_LABELS[view]} of ${van.label}. ${objects.length} object${
          objects.length === 1 ? '' : 's'
        }. Tab to step through them, arrow keys to move the selection.`}
        onWheel={bind.onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GridPattern strokeWidth={strokeWidth} gridMm={settings.gridMm} />

        <VanShell van={van} view={view} strokeWidth={strokeWidth} showLabels />

        {showRuns && (
          <SystemRuns
            runs={runs}
            view={view}
            interior={van.interior}
            visibleLayers={visibleLayers}
            strokeWidth={strokeWidth}
          />
        )}

        {sorted.map((object) => (
          <ObjectShape
            key={object.id}
            object={object}
            view={view}
            interior={interior}
            selected={selectedIds.includes(object.id)}
            flagged={flaggedIds.has(object.id)}
            faulty={faultyIds.has(object.id)}
            cutHeight={cutHeight}
            ghostingEnabled={ghostingEnabled}
            strokeWidth={strokeWidth}
            showLabel
            onPointerDown={beginMove}
          />
        ))}

        {/* Alignment guides, shown only while they are being used. */}
        {guides.map((guide, index) => {
          const axes = viewPositionAxes(view)
          const vertical = axes.u === guide.axis
          const horizontal = axes.v === guide.axis
          if (!vertical && !horizontal) return null

          const value =
            horizontal && view !== 'top' ? van.interior.h - guide.value : guide.value

          return (
            <line
              key={`${guide.axis}-${index}`}
              x1={vertical ? value : -400}
              x2={vertical ? value : bounds.w + 400}
              y1={vertical ? -400 : value}
              y2={vertical ? bounds.h + 400 : value}
              stroke="var(--color-accent)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeWidth * 8} ${strokeWidth * 6}`}
            />
          )
        })}

        {selectedIds.length > 0 &&
          selectedIds.map((id) => {
            const object = objects.find((candidate) => candidate.id === id)
            if (!object) return null
            const rect = projectObject(object, view, van.interior).rect

            return (
              <g key={`handles-${id}`}>
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 4}`}
                />
                {selectedIds.length === 1 &&
                  HANDLES.map((handle) => (
                    <rect
                      key={handle.id}
                      x={rect.x + rect.w * handle.u - handleSize / 2}
                      y={rect.y + rect.h * handle.v - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      fill="var(--color-surface-raised)"
                      stroke="var(--color-accent)"
                      strokeWidth={strokeWidth * 1.5}
                      style={{ cursor: handle.cursor }}
                      onPointerDown={(event) => beginResize(event, id, handle.id)}
                    />
                  ))}
              </g>
            )
          })}

        {drag.kind === 'marquee' && (
          <rect
            x={Math.min(drag.start.x, drag.current.x)}
            y={Math.min(drag.start.y, drag.current.y)}
            width={Math.abs(drag.current.x - drag.start.x)}
            height={Math.abs(drag.current.y - drag.start.y)}
            fill="var(--color-accent)"
            fillOpacity={0.08}
            stroke="var(--color-accent)"
            strokeWidth={strokeWidth}
          />
        )}

        {view === 'top' && <CutHeightBadge cutHeight={cutHeight} bounds={bounds} />}
      </svg>

      {/* Read out when the selection changes, for anyone not looking at it. */}
      <p aria-live="polite" className="sr-only">
        {selectedIds.length === 0
          ? 'Nothing selected'
          : selectedIds.length === 1
            ? `Selected ${objects.find((object) => object.id === selectedIds[0])?.name ?? ''}`
            : `${selectedIds.length} objects selected`}
      </p>
    </div>
  )
}

/** Background grid, sized to the user's snap interval. */
function GridPattern({ strokeWidth, gridMm }: { strokeWidth: number; gridMm: number }) {
  // Draw a coarse multiple of the snap grid: at 10mm the lines would be denser
  // than the pixels available and read as a flat wash.
  const spacing = Math.max(gridMm, 100)

  return (
    <>
      <defs>
        <pattern id="grid" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <path
            d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
        </pattern>
      </defs>
      <rect x={-20000} y={-20000} width={60000} height={60000} fill="url(#grid)" />
    </>
  )
}

function CutHeightBadge({
  cutHeight,
  bounds,
}: {
  cutHeight: number
  bounds: { w: number; h: number }
}) {
  return (
    <text
      x={bounds.w / 2}
      y={-120}
      textAnchor="middle"
      fontSize={110}
      fill="var(--color-ink-faint)"
    >
      section at {Math.round(cutHeight)} mm
    </text>
  )
}
