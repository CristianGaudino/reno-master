/**
 * The van itself: interior outline, wall taper, obstacles and door apertures.
 *
 * Drawn in view coordinates, so the same component serves all three views.
 */

import { Fragment } from 'react'
import type { ResolvedVan, ViewMode } from '../../lib/definitions'
import { interiorRect, projectObject } from '../../lib/geometry'
import { swingArcPath } from '../../lib/geometry'

const OBSTACLE_STYLES: Record<
  string,
  { fill: string; stroke: string; dash?: string; label: boolean }
> = {
  wheel_well: { fill: 'oklch(0.86 0.02 250)', stroke: 'oklch(0.6 0.03 250)', label: true },
  b_pillar: { fill: 'oklch(0.82 0.02 250)', stroke: 'oklch(0.55 0.03 250)', label: false },
  intrusion: { fill: 'oklch(0.86 0.02 250)', stroke: 'oklch(0.6 0.03 250)', label: true },
  aperture_side: {
    fill: 'oklch(0.93 0.05 150)',
    stroke: 'oklch(0.6 0.1 150)',
    dash: '40 24',
    label: true,
  },
  aperture_rear: {
    fill: 'oklch(0.93 0.05 150)',
    stroke: 'oklch(0.6 0.1 150)',
    dash: '40 24',
    label: true,
  },
  mount_point: { fill: 'none', stroke: 'oklch(0.65 0.02 250)', dash: '10 10', label: false },
}

export function VanShell({
  van,
  view,
  strokeWidth,
  showLabels,
}: {
  van: ResolvedVan
  view: ViewMode
  /** In model units, so line weight stays constant on screen as you zoom. */
  strokeWidth: number
  showLabels: boolean
}) {
  const bounds = interiorRect(van.interior, view)

  return (
    <g>
      {/* Interior floor/wall plane */}
      <rect
        x={0}
        y={0}
        width={bounds.w}
        height={bounds.h}
        fill="var(--color-surface-raised)"
        stroke="var(--color-ink)"
        strokeWidth={strokeWidth * 1.5}
      />

      {view === 'rear' && <TaperOutline van={van} strokeWidth={strokeWidth} />}
      {view === 'top' && <WheelbaseMarkers van={van} strokeWidth={strokeWidth} />}

      {van.obstacles.map((obstacle) => {
        const style = OBSTACLE_STYLES[obstacle.kind]
        if (!style) return null

        const projected = projectObject(
          { position: obstacle.position, size: obstacle.size, yaw: 0 },
          view,
          van.interior,
        )

        return (
          <Fragment key={obstacle.id}>
            <rect
              x={projected.rect.x}
              y={projected.rect.y}
              width={projected.rect.w}
              height={projected.rect.h}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={style.dash}
            />

            {/* Door swing envelopes. These sweep outside the van, so they are
                drawn for orientation rather than as a constraint on the layout. */}
            {view === 'top' && obstacle.articulation && obstacle.articulation.kind === 'hinge' && (
              <path
                d={swingArcPath(obstacle.articulation)}
                fill="oklch(0.6 0.1 150 / 0.08)"
                stroke={style.stroke}
                strokeWidth={strokeWidth * 0.75}
                strokeDasharray="30 18"
              />
            )}

            {showLabels && view === 'top' && style.label && projected.rect.w > 200 && (
              <text
                x={projected.rect.x + projected.rect.w / 2}
                y={projected.rect.y + projected.rect.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(90, projected.rect.h * 0.5)}
                fill="oklch(0.45 0.02 250)"
              >
                {obstacle.name}
              </text>
            )}
          </Fragment>
        )
      })}
    </g>
  )
}

/**
 * The wall taper, drawn only in the rear elevation where it is visible.
 *
 * This is the view that shows why a shoulder-height cabinet does not fit where a
 * floor cabinet does.
 */
function TaperOutline({ van, strokeWidth }: { van: ResolvedVan; strokeWidth: number }) {
  if (van.taper.length === 0) return null

  const sorted = [...van.taper].sort((a, b) => a.z - b.z)
  const height = van.interior.h

  const left = sorted.map((point) => `${point.insetLeft},${height - point.z}`)
  const right = sorted
    .slice()
    .reverse()
    .map((point) => `${van.interior.w - point.insetRight},${height - point.z}`)

  return (
    <polyline
      points={[...left, ...right].join(' ')}
      fill="none"
      stroke="var(--color-ink-faint)"
      strokeWidth={strokeWidth}
      strokeDasharray="24 16"
    />
  )
}

/** Axle positions in the top view, so weight distribution has a visual anchor. */
function WheelbaseMarkers({ van, strokeWidth }: { van: ResolvedVan; strokeWidth: number }) {
  if (van.rearAxleY <= van.frontAxleY) return null

  return (
    <g>
      {[
        { y: van.frontAxleY, label: 'Front axle' },
        { y: van.rearAxleY, label: 'Rear axle' },
      ].map((axle) => (
        <g key={axle.label}>
          <line
            x1={-250}
            x2={van.interior.w + 250}
            y1={axle.y}
            y2={axle.y}
            stroke="var(--color-ink-faint)"
            strokeWidth={strokeWidth}
            strokeDasharray="60 30"
          />
          <text
            x={van.interior.w + 270}
            y={axle.y}
            dominantBaseline="middle"
            fontSize={80}
            fill="var(--color-ink-faint)"
          >
            {axle.label}
          </text>
        </g>
      ))}
    </g>
  )
}
