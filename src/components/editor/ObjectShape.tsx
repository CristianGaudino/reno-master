/**
 * One object, drawn in whichever view is active.
 *
 * The top view draws the true rotated footprint; the elevations draw the
 * silhouette, which for a box rotated about z is exactly its axis-aligned
 * extent. Both come from `projectObject`, so the two can never disagree.
 */

import { memo } from 'react'
import { GHOST_OPACITY } from '../../lib/config'
import type { Size3, VanObject, ViewMode } from '../../lib/definitions'
import { isAboveCut, projectObject, swingArcPath } from '../../lib/geometry'
import { cn } from '../../lib/cn'

interface ObjectShapeProps {
  object: VanObject
  view: ViewMode
  interior: Size3
  selected: boolean
  /** Highlighted because a warning the user is looking at names it. */
  flagged: boolean
  /** Involved in an error-level finding. */
  faulty: boolean
  cutHeight: number
  ghostingEnabled: boolean
  strokeWidth: number
  showLabel: boolean
  onPointerDown(event: React.PointerEvent, id: string): void
}

/**
 * Memoised.
 *
 * Dragging one object replaces only that object in the store array, so every
 * other shape receives identical props and can skip re-rendering entirely. That
 * only holds while the callbacks passed in are stable — see `Canvas`, where the
 * pointer handlers read the scene from the store rather than closing over it.
 */
export const ObjectShape = memo(function ObjectShape({
  object,
  view,
  interior,
  selected,
  flagged,
  faulty,
  cutHeight,
  ghostingEnabled,
  strokeWidth,
  showLabel,
  onPointerDown,
}: ObjectShapeProps) {
  const projected = projectObject(object, view, interior)

  // Ghosting applies only to the top view: it exists to answer "what is at this
  // height", which the elevations already show directly.
  const ghosted = view === 'top' && ghostingEnabled && isAboveCut(object, cutHeight)

  const points = projected.outline.map((point) => `${point.x},${point.y}`).join(' ')
  const centre = {
    x: projected.rect.x + projected.rect.w / 2,
    y: projected.rect.y + projected.rect.h / 2,
  }

  const stroke = faulty
    ? 'var(--color-danger)'
    : selected
      ? 'var(--color-accent)'
      : 'var(--color-ink)'

  return (
    <g
      className={cn('cursor-move', ghosted && 'pointer-events-none')}
      opacity={ghosted ? GHOST_OPACITY : 1}
      onPointerDown={(event) => onPointerDown(event, object.id)}
    >
      <polygon
        points={points}
        fill={object.color}
        fillOpacity={object.kind === 'loose' ? 0.35 : 0.75}
        stroke={stroke}
        strokeWidth={strokeWidth * (selected || faulty ? 2.5 : 1)}
        strokeDasharray={
          object.kind === 'loose' ? `${strokeWidth * 8} ${strokeWidth * 6}` : undefined
        }
      />

      {flagged && (
        <polygon
          points={points}
          fill="none"
          stroke="var(--color-warn)"
          strokeWidth={strokeWidth * 4}
          strokeOpacity={0.7}
        />
      )}

      {/* Swing arc, in the view where it means something. */}
      {view === 'top' && object.articulation && object.articulation.kind !== 'slide' && (
        <path
          d={swingArcPath(object.articulation)}
          fill={faulty ? 'var(--color-danger)' : object.color}
          fillOpacity={faulty ? 0.16 : 0.1}
          stroke={faulty ? 'var(--color-danger)' : 'var(--color-ink-faint)'}
          strokeWidth={strokeWidth}
          strokeDasharray={`${strokeWidth * 6} ${strokeWidth * 4}`}
        />
      )}

      {/*
        Centred in plan, but pinned to the top-left corner in the elevations:
        objects stack in front of one another there, and centred labels end up
        written across each other.
      */}
      {showLabel && projected.rect.w > 260 && projected.rect.h > 120 && (
        <text
          x={view === 'top' ? centre.x : projected.rect.x + 40}
          y={view === 'top' ? centre.y : projected.rect.y + 40}
          textAnchor={view === 'top' ? 'middle' : 'start'}
          dominantBaseline={view === 'top' ? 'middle' : 'hanging'}
          fontSize={Math.min(90, projected.rect.h * 0.24)}
          fill="var(--color-ink)"
          fillOpacity={0.85}
        >
          {object.name}
        </text>
      )}
    </g>
  )
})
