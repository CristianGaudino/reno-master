import { describe, expect, it } from 'vitest'
import type { Articulation, Size3, TaperPoint, Vec3 } from '../definitions'
import { interiorXRangeAt, narrowestXRangeBetween } from './frame'
import { box3From, footprintFrom } from './obb'
import { footprintsOverlap } from './sat'
import { boxWithinBounds, horizontalGap, intersects3D } from './overlap'
import { projectObject, viewDeltaToModel } from './project'
import {
  articulationFromTemplate,
  evaluateSwing,
  leafPolygonAt,
  transformArticulation,
} from './sector'
import { measureCorridor } from './corridor'

const box = (position: Vec3, size: Size3, yaw = 0) => box3From(position, size, yaw)

describe('separating-axis overlap', () => {
  it('treats flush-butted objects as touching, not colliding', () => {
    // Cabinets butted against each other is the normal case in a van build.
    // If this reports a conflict the warnings are noise.
    const a = footprintFrom({ x: 0, y: 0, z: 0 }, { w: 500, d: 500, h: 500 }, 0)
    const b = footprintFrom({ x: 500, y: 0, z: 0 }, { w: 500, d: 500, h: 500 }, 0)
    expect(footprintsOverlap(a, b).overlapping).toBe(false)
  })

  it('detects a genuine overlap and reports how far in', () => {
    const a = footprintFrom({ x: 0, y: 0, z: 0 }, { w: 500, d: 500, h: 500 }, 0)
    const b = footprintFrom({ x: 450, y: 0, z: 0 }, { w: 500, d: 500, h: 500 }, 0)
    const result = footprintsOverlap(a, b)
    expect(result.overlapping).toBe(true)
    expect(result.penetration).toBeCloseTo(49, 0)
  })

  it('does not report a conflict between rotated boxes that clear each other', () => {
    // The axis-aligned bounds of these two overlap, but the boxes themselves do
    // not. Approximating rotation with an AABB is exactly the false positive
    // that makes an accuracy tool untrustworthy.
    // Two parallel bars at 45 degrees, offset 150mm perpendicular to their
    // length. Each is 100mm thick, so they clear by 50mm — while their
    // axis-aligned bounds overlap across hundreds of millimetres.
    const a = footprintFrom({ x: 0, y: 0, z: 0 }, { w: 1000, d: 100, h: 500 }, 45)
    const b = footprintFrom({ x: -106.07, y: 106.07, z: 0 }, { w: 1000, d: 100, h: 500 }, 45)
    expect(footprintsOverlap(a, b).overlapping).toBe(false)
  })

  it('detects overlap between two rotated boxes that do intersect', () => {
    const a = footprintFrom({ x: 0, y: 0, z: 0 }, { w: 1000, d: 200, h: 500 }, 45)
    const b = footprintFrom({ x: 0, y: 0, z: 0 }, { w: 1000, d: 200, h: 500 }, -45)
    expect(footprintsOverlap(a, b).overlapping).toBe(true)
  })
})

describe('3D intersection', () => {
  it('allows an overhead locker directly above a worktop', () => {
    // Same footprint, different heights. Testing plan overlap alone would call
    // this a conflict, and it is the single most common legitimate arrangement.
    const worktop = box({ x: 0, y: 0, z: 850 }, { w: 600, d: 1200, h: 40 })
    const locker = box({ x: 0, y: 0, z: 1300 }, { w: 600, d: 1200, h: 400 })
    expect(intersects3D(worktop, locker).intersecting).toBe(false)
  })

  it('flags objects that share both plan and height', () => {
    const bed = box({ x: 0, y: 2000, z: 400 }, { w: 1400, d: 1900, h: 200 })
    const unit = box({ x: 1200, y: 2100, z: 300 }, { w: 500, d: 600, h: 900 })
    const result = intersects3D(bed, unit)
    expect(result.intersecting).toBe(true)
    expect(result.horizontal).toBeGreaterThan(0)
  })

  it('measures the gap between objects that are clear of each other', () => {
    const a = box({ x: 0, y: 0, z: 0 }, { w: 500, d: 500, h: 500 })
    const b = box({ x: 800, y: 0, z: 0 }, { w: 500, d: 500, h: 500 })
    expect(horizontalGap(a, b)).toBeCloseTo(300, 0)
  })
})

describe('interior bounds', () => {
  it('accounts for the space a rotated object actually sweeps into', () => {
    // A 1200x400 unit fits a 1000mm-wide van square on, but not at 45 degrees.
    const bounds = { w: 1000, d: 3000, h: 1900 }
    const square = box({ x: 0, y: 0, z: 0 }, { w: 900, d: 400, h: 500 }, 0)
    expect(boxWithinBounds(square, bounds).inside).toBe(true)

    const angled = box({ x: 0, y: 500, z: 0 }, { w: 900, d: 400, h: 500 }, 45)
    expect(boxWithinBounds(angled, bounds).inside).toBe(false)
  })

  it('names which side was exceeded', () => {
    const bounds = { w: 1750, d: 3000, h: 1900 }
    const tall = box({ x: 100, y: 100, z: 0 }, { w: 400, d: 400, h: 2000 })
    const result = boxWithinBounds(tall, bounds)
    expect(result.exceeded).toContain('roof')
    expect(result.worst).toBeCloseTo(100, 0)
  })
})

describe('wall taper', () => {
  // Vans are not boxes. A cabinet that fits at floor level can foul the wall at
  // shoulder height, and that is a real failure mode this must catch.
  const taper: TaperPoint[] = [
    { z: 0, insetLeft: 0, insetRight: 0 },
    { z: 1000, insetLeft: 0, insetRight: 0 },
    { z: 1800, insetLeft: 120, insetRight: 120 },
  ]

  it('interpolates the inset between profile samples', () => {
    expect(interiorXRangeAt(1000, 1750, taper)).toEqual({ min: 0, max: 1750 })
    const midway = interiorXRangeAt(1400, 1750, taper)
    expect(midway.min).toBeCloseTo(60, 0)
    expect(midway.max).toBeCloseTo(1690, 0)
  })

  it('takes the tightest slice across a tall object, not its base', () => {
    const range = narrowestXRangeBetween(0, 1800, 1750, taper)
    expect(range.min).toBeCloseTo(120, 0)
    expect(range.max).toBeCloseTo(1630, 0)
  })

  it('leaves a floor-level object the full width', () => {
    const range = narrowestXRangeBetween(0, 600, 1750, taper)
    expect(range.min).toBeCloseTo(0, 0)
    expect(range.max).toBeCloseTo(1750, 0)
  })
})

describe('view projection', () => {
  const interior: Size3 = { w: 1750, d: 3000, h: 1900 }

  it('places a cabinet consistently in all three views', () => {
    const cabinet = {
      position: { x: 200, y: 500, z: 900 },
      size: { w: 600, d: 400, h: 700 },
      yaw: 0,
    }

    const top = projectObject(cabinet, 'top', interior)
    expect(top.rect).toMatchObject({ x: 200, y: 500, w: 600, h: 400 })
    expect(top.throughMin).toBe(900)

    // Side elevation: horizontal is y, vertical is z flipped so the roof is up.
    const side = projectObject(cabinet, 'side', interior)
    expect(side.rect).toMatchObject({ x: 500, y: 1900 - 1600, w: 400, h: 700 })

    const rear = projectObject(cabinet, 'rear', interior)
    expect(rear.rect).toMatchObject({ x: 200, y: 1900 - 1600, w: 600, h: 700 })
  })

  it('maps an upward drag in an elevation to an increase in z', () => {
    // Screen y grows downward, model z grows upward. Getting this backwards
    // makes the elevations feel broken.
    expect(viewDeltaToModel(0, -100, 'side')).toEqual({ y: 0, z: 100 })
    expect(viewDeltaToModel(0, 100, 'top')).toEqual({ x: 0, y: 100 })
  })

  it('silhouettes a rotated object to its true extent in elevation', () => {
    const rotated = {
      position: { x: 0, y: 0, z: 0 },
      size: { w: 1000, d: 200, h: 500 },
      yaw: 90,
    }
    const rear = projectObject(rotated, 'rear', interior)
    // Rotated 90 degrees, its 1000mm length now runs along y, so it presents
    // only 200mm of width to the rear view.
    expect(rear.rect.w).toBeCloseTo(200, 0)
  })
})

describe('swing arcs', () => {
  const doorAt = (sweep: number): Articulation => ({
    kind: 'hinge',
    hinge: { x: 0, y: 0 },
    leafLength: 500,
    leafThickness: 18,
    startAngle: 0,
    sweepAngle: sweep,
    zRange: { min: 300, max: 1500 },
  })

  it('reports a clear swing when nothing is in the way', () => {
    const result = evaluateSwing(doorAt(90), [])
    expect(result.blocked).toBe(false)
    expect(result.maxOpenAngle).toBe(90)
  })

  it('names the angle at which the door fouls', () => {
    // A wall across the swing at y = 400. The leaf tip reaches y = 400 at
    // asin(400/500) = 53.1 degrees, so with 5-degree sampling the first fouling
    // pose is 55 and the last clear one is 50.
    const bed = {
      id: 'bed',
      name: 'Bed platform',
      box: box({ x: -1000, y: 400, z: 300 }, { w: 2000, d: 600, h: 400 }),
    }
    const result = evaluateSwing(doorAt(90), [bed])

    expect(result.blocked).toBe(true)
    expect(result.maxOpenAngle).toBe(50)
    expect(result.blockers[0]?.name).toBe('Bed platform')
    expect(result.blockers[0]?.angle).toBe(55)
  })

  it('ignores obstructions outside the leaf height range', () => {
    // A fridge door at knee height is unobstructed by an overhead locker.
    const locker = {
      id: 'locker',
      name: 'Overhead locker',
      box: box({ x: -1000, y: 300, z: 1600 }, { w: 2000, d: 600, h: 300 }),
    }
    expect(evaluateSwing(doorAt(90), [locker]).blocked).toBe(false)
  })

  it('puts the leaf where the geometry says it should be', () => {
    const polygon = leafPolygonAt(doorAt(90), 90)
    // Opened to 90 degrees, the tip should be 500mm along +y from the hinge.
    expect(polygon[1]?.x).toBeCloseTo(0, 6)
    expect(polygon[1]?.y).toBeCloseTo(500, 6)
  })

  it('carries the hinge along when its cabinet moves', () => {
    const before = {
      position: { x: 0, y: 0, z: 0 },
      size: { w: 600, d: 600, h: 1000 },
      yaw: 0,
    }
    const after = { ...before, position: { x: 1000, y: 200, z: 0 } }
    const moved = transformArticulation(doorAt(90), before, after)
    expect(moved.hinge.x).toBeCloseTo(1000, 6)
    expect(moved.hinge.y).toBeCloseTo(200, 6)
  })

  it('lays a closed door flat along the face it hangs on', () => {
    // A shut door does not stick out at ninety degrees. Getting this wrong made
    // every catalog cabinet appear to foul its neighbour before anyone touched
    // it, which is the check the whole tool is built around.
    const articulation = articulationFromTemplate(
      {
        kind: 'hinge',
        hingeCorner: 'front-left',
        doorFace: 'front',
        leafLength: 500,
        leafThickness: 20,
        sweepAngle: 90,
        zOffsetMin: 0,
        zOffsetMax: 600,
      },
      { x: 0, y: 0, z: 0 },
      { w: 500, d: 400, h: 600 },
      0,
    )

    // Hinged front-left, the closed leaf runs along the front face toward +x.
    const closed = leafPolygonAt(articulation, articulation.startAngle)
    expect(closed[1]?.x).toBeCloseTo(500, 6)
    expect(closed[1]?.y).toBeCloseTo(0, 6)

    // Opening swings it out of the front of the cabinet, into -y.
    const open = leafPolygonAt(articulation, articulation.startAngle + articulation.sweepAngle)
    expect(open[1]?.x).toBeCloseTo(0, 6)
    expect(open[1]?.y).toBeCloseTo(-500, 6)
  })

  it('opens a right-hand-face door outward too', () => {
    const articulation = articulationFromTemplate(
      {
        kind: 'hinge',
        hingeCorner: 'front-right',
        doorFace: 'right',
        leafLength: 400,
        leafThickness: 20,
        sweepAngle: 90,
        zOffsetMin: 0,
        zOffsetMax: 600,
      },
      { x: 0, y: 0, z: 0 },
      { w: 500, d: 400, h: 600 },
      0,
    )

    const open = leafPolygonAt(articulation, articulation.startAngle + articulation.sweepAngle)
    // Swings out past the right-hand face, which sits at x = 500.
    expect(open[1]?.x).toBeCloseTo(900, 6)
    expect(open[1]?.y).toBeCloseTo(0, 6)
  })

  it('rotates the swing with its cabinet', () => {
    const before = {
      position: { x: 0, y: 0, z: 0 },
      size: { w: 600, d: 600, h: 1000 },
      yaw: 0,
    }
    const after = { ...before, yaw: 90 }
    const rotated = transformArticulation(doorAt(90), before, after)
    expect(rotated.startAngle).toBeCloseTo(90, 6)
  })
})

describe('corridor measurement', () => {
  const interior: Size3 = { w: 1750, d: 3000, h: 1900 }

  it('measures the full width when the van is empty', () => {
    const result = measureCorridor(interior, [], [])
    expect(result.minWidth).toBeCloseTo(1750, 0)
  })

  it('measures the gap left between two facing units', () => {
    const left = {
      id: 'galley',
      box: box({ x: 0, y: 1000, z: 0 }, { w: 600, d: 1000, h: 900 }),
    }
    const right = {
      id: 'wardrobe',
      box: box({ x: 1350, y: 1000, z: 0 }, { w: 400, d: 1000, h: 1600 }),
    }
    const result = measureCorridor(interior, [], [left, right])
    expect(result.minWidth).toBeCloseTo(750, 0)
    expect(result.culpritIds).toEqual(expect.arrayContaining(['galley', 'wardrobe']))
  })

  it('ignores obstructions below the height a body occupies', () => {
    // A water tank under a raised bed does not narrow the walkway.
    const tank = {
      id: 'tank',
      box: box({ x: 0, y: 1000, z: 0 }, { w: 800, d: 1000, h: 150 }),
    }
    const result = measureCorridor(interior, [], [tank])
    expect(result.minWidth).toBeCloseTo(1750, 0)
  })

  it('treats a bed across the back as the end of the corridor, not a blockage', () => {
    // Nearly every van has a full-width bed at the rear. The walkway runs up to
    // it and stops; reporting a zero-width corridor for the most common layout
    // there is would be alarming and wrong.
    const bed = {
      id: 'bed',
      box: box({ x: 0, y: 1800, z: 300 }, { w: 1750, d: 1200, h: 500 }),
    }
    const result = measureCorridor(interior, [], [bed])
    expect(result.minWidth).toBeCloseTo(1750, 0)
  })

  it('treats a bed that stops short of the rear doors as the end too', () => {
    // Beds are set forward of the doors, leaving a sliver of floor behind them.
    // That sliver is the gap behind the bed, not a room, and must not make the
    // bed look like a partition with usable space beyond it.
    const bed = {
      id: 'bed',
      box: box({ x: 0, y: 1750, z: 300 }, { w: 1750, d: 1200, h: 500 }),
    }
    const result = measureCorridor(interior, [], [bed])
    expect(result.minWidth).toBeCloseTo(1750, 0)
  })

  it('still reports a full-width blockage with usable space behind it', () => {
    // Same bed, but parked in the middle: now the back of the van is cut off,
    // which is a real problem rather than the corridor simply ending.
    const wall = {
      id: 'partition',
      box: box({ x: 0, y: 1200, z: 300 }, { w: 1750, d: 300, h: 900 }),
    }
    const result = measureCorridor(interior, [], [wall])
    expect(result.minWidth).toBe(0)
  })

  it('narrows the walkway where the walls taper inward', () => {
    const taper: TaperPoint[] = [
      { z: 0, insetLeft: 0, insetRight: 0 },
      { z: 1400, insetLeft: 100, insetRight: 100 },
    ]
    const result = measureCorridor(interior, taper, [])
    expect(result.minWidth).toBeCloseTo(1550, 0)
  })
})
