import { describe, expect, it } from 'vitest'
import { RULE_IDS, STANDARD_HEIGHT_MM } from '../constants'
import type {
  ObjectCategory,
  ObjectKind,
  ResolvedVan,
  UserSettings,
  VanObject,
  VanObstacle,
} from '../definitions'
import { buildContext, evaluateScene } from './engine'
import { ALL_RULES, ruleById } from './registry'
import { summariseLoad } from './weight/load'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const van = (overrides: Partial<ResolvedVan> = {}): ResolvedVan => ({
  interior: { w: 1750, d: 3100, h: 1900 },
  taper: [],
  payload: 1_000_000,
  gvwr: 3_500_000,
  frontAxleY: -800,
  rearAxleY: 2700,
  kerbFrontAxle: 1_100_000,
  kerbRearAxle: 900_000,
  obstacles: [],
  modelId: 'test-van',
  label: 'Test van',
  confidence: 'approximate',
  sourceNote: null,
  hasOverrides: false,
  ...overrides,
})

let counter = 0
const object = (overrides: Partial<VanObject> = {}): VanObject => {
  counter += 1
  return {
    id: `object-${counter}`,
    projectId: 'project',
    name: `Object ${counter}`,
    category: 'storage' as ObjectCategory,
    kind: 'fixed' as ObjectKind,
    position: { x: 0, y: 0, z: 0 },
    size: { w: 400, d: 400, h: 400 },
    yaw: 0,
    mass: 0,
    cost: 0,
    color: '#888888',
    articulation: null,
    connections: [],
    zIndex: 0,
    notes: null,
    ...overrides,
  }
}

const settings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
  userId: 'user',
  heightMm: null,
  unitSystem: 'metric',
  disabledRules: [],
  gridMm: 10,
  ghostingEnabled: true,
  snapToObjects: true,
  ...overrides,
})

const run = (
  objects: VanObject[],
  options: { van?: ResolvedVan; settings?: UserSettings; rules?: typeof ALL_RULES } = {},
) =>
  evaluateScene(
    buildContext(options.van ?? van(), objects, options.settings ?? settings()),
    options.rules ?? ALL_RULES,
  )

const findingsFor = (report: ReturnType<typeof run>, ruleId: string) =>
  report.findings.filter((finding) => finding.ruleId === ruleId)

// ---------------------------------------------------------------------------

describe('hard conflicts', () => {
  it('reports two objects sharing the same space', () => {
    const report = run([
      object({ name: 'Galley', position: { x: 0, y: 0, z: 0 }, size: { w: 600, d: 1000, h: 900 } }),
      object({ name: 'Fridge', position: { x: 400, y: 0, z: 0 }, size: { w: 600, d: 600, h: 900 } }),
    ])
    expect(findingsFor(report, RULE_IDS.OBJECT_OVERLAP)).toHaveLength(1)
  })

  it('allows an overhead locker directly above a worktop', () => {
    const report = run([
      object({ name: 'Worktop', position: { x: 0, y: 0, z: 0 }, size: { w: 600, d: 1200, h: 900 } }),
      object({ name: 'Locker', position: { x: 0, y: 0, z: 1300 }, size: { w: 600, d: 1200, h: 400 } }),
    ])
    expect(findingsFor(report, RULE_IDS.OBJECT_OVERLAP)).toHaveLength(0)
  })

  it('exempts loose objects from clearance checks but still weighs them', () => {
    // Spec section 2: a beanbag shoved against the bed is not a build error,
    // but it still counts toward payload.
    const objects = [
      object({ name: 'Bed', position: { x: 0, y: 0, z: 0 }, size: { w: 1400, d: 1900, h: 400 } }),
      object({
        name: 'Beanbag',
        kind: 'loose',
        position: { x: 200, y: 200, z: 0 },
        size: { w: 700, d: 700, h: 600 },
        mass: 8_000,
      }),
    ]

    const report = run(objects)
    expect(findingsFor(report, RULE_IDS.OBJECT_OVERLAP)).toHaveLength(0)

    const load = summariseLoad(buildContext(van(), objects, settings()))
    expect(load.total).toBe(8_000)
  })

  it('flags a cabinet that fits at floor level but fouls the tapered wall higher up', () => {
    const tapered = van({
      taper: [
        { z: 0, insetLeft: 0, insetRight: 0 },
        { z: 1000, insetLeft: 0, insetRight: 0 },
        { z: 1800, insetLeft: 150, insetRight: 150 },
      ],
    })

    const low = run([object({ position: { x: 0, y: 0, z: 0 }, size: { w: 400, d: 400, h: 500 } })], {
      van: tapered,
    })
    expect(findingsFor(low, RULE_IDS.OUT_OF_BOUNDS)).toHaveLength(0)

    // Same footprint against the wall, but now tall enough to reach the lean-in.
    const tall = run(
      [object({ position: { x: 0, y: 0, z: 0 }, size: { w: 400, d: 400, h: 1800 } })],
      { van: tapered },
    )
    expect(findingsFor(tall, RULE_IDS.OUT_OF_BOUNDS)).toHaveLength(1)
    expect(findingsFor(tall, RULE_IDS.OUT_OF_BOUNDS)[0]?.message).toContain('left wall')
  })

  it('names the angle at which a door fouls', () => {
    // The headline check in the spec. A wall of bed 400mm from the hinge stops a
    // 500mm leaf at roughly 53 degrees, so with 5-degree sampling it opens to 50.
    const report = run([
      object({
        name: 'Fridge',
        kind: 'articulated',
        position: { x: 0, y: 0, z: 300 },
        size: { w: 600, d: 600, h: 900 },
        articulation: {
          kind: 'hinge',
          hinge: { x: 0, y: 0 },
          leafLength: 500,
          leafThickness: 18,
          startAngle: 0,
          sweepAngle: 90,
          zRange: { min: 300, max: 1200 },
        },
      }),
      object({
        name: 'Bed platform',
        position: { x: 0, y: 400, z: 300 },
        size: { w: 1400, d: 600, h: 400 },
      }),
    ])

    const swing = findingsFor(report, RULE_IDS.SWING_BLOCKED)
    expect(swing).toHaveLength(1)
    expect(swing[0]?.message).toBe('Fridge fouls Bed platform at 55° of 90°')
    expect(swing[0]?.measured).toEqual({ value: 50, threshold: 90 })
  })

  it('leaves a door alone when nothing is in its way', () => {
    const report = run([
      object({
        name: 'Fridge',
        kind: 'articulated',
        position: { x: 0, y: 0, z: 300 },
        size: { w: 600, d: 600, h: 900 },
        articulation: {
          kind: 'hinge',
          hinge: { x: 200, y: 600 },
          leafLength: 500,
          leafThickness: 18,
          startAngle: 0,
          sweepAngle: 90,
          zRange: { min: 300, max: 1200 },
        },
      }),
    ])
    expect(findingsFor(report, RULE_IDS.SWING_BLOCKED)).toHaveLength(0)
  })

  it('reports an object standing in a doorway', () => {
    const aperture: VanObstacle = {
      id: 'side-door',
      vanModelId: 'test-van',
      kind: 'aperture_side',
      name: 'Sliding door aperture',
      position: { x: 1650, y: 900, z: 0 },
      size: { w: 100, d: 1300, h: 1700 },
      articulation: null,
      confidence: 'approximate',
    }

    const report = run(
      [object({ name: 'Wardrobe', position: { x: 1400, y: 1000, z: 0 }, size: { w: 350, d: 600, h: 1700 } })],
      { van: van({ obstacles: [aperture] }) },
    )

    expect(findingsFor(report, RULE_IDS.APERTURE_BLOCKED).length).toBeGreaterThan(0)
  })
})

describe('ergonomic warnings', () => {
  it('always reports against the 6ft standard, whatever the user height', () => {
    // Spec section 4: the designer is not the only person who will ever use the
    // van, so a short user must still be told what a tall one would find.
    // 1750mm of bed: comfortable at 1620mm tall (needs 1720), short of the
    // 1929mm a 6ft body wants.
    const shortUser = settings({ heightMm: 1620 })
    const report = run(
      [object({ category: 'sleeping', name: 'Bed', size: { w: 1400, d: 1750, h: 400 } })],
      { settings: shortUser },
    )

    const bedFindings = findingsFor(report, RULE_IDS.BED_LENGTH)
    expect(bedFindings).toHaveLength(1)

    const personas = bedFindings[0]?.personas ?? []
    expect(personas.map((persona) => persona.persona)).toEqual(['standard', 'user'])

    const standard = personas.find((persona) => persona.persona === 'standard')
    const user = personas.find((persona) => persona.persona === 'user')

    expect(standard?.heightMm).toBe(STANDARD_HEIGHT_MM)
    expect(standard?.passes).toBe(false)
    // Fits the user but not the standard body — exactly the split the spec asks
    // to be surfaced rather than collapsed into one verdict.
    expect(user?.passes).toBe(true)
  })

  it('does not report the same body twice for a 6ft user', () => {
    const report = run(
      [object({ category: 'sleeping', name: 'Bed', size: { w: 1400, d: 1700, h: 400 } })],
      { settings: settings({ heightMm: 1829 }) },
    )
    expect(findingsFor(report, RULE_IDS.BED_LENGTH)[0]?.personas).toHaveLength(1)
  })

  it('measures the walkway between two facing units', () => {
    const report = run([
      object({ name: 'Galley', position: { x: 0, y: 800, z: 0 }, size: { w: 650, d: 1200, h: 900 } }),
      object({ name: 'Wardrobe', position: { x: 1100, y: 800, z: 0 }, size: { w: 650, d: 1200, h: 1600 } }),
    ])

    const aisle = findingsFor(report, RULE_IDS.AISLE_WIDTH)
    expect(aisle).toHaveLength(1)
    expect(aisle[0]?.measured?.value).toBeCloseTo(450, -1)
  })

  it('does not count a low tank against the walkway', () => {
    const report = run([
      object({ name: 'Water tank', position: { x: 0, y: 800, z: 0 }, size: { w: 900, d: 1200, h: 150 } }),
    ])
    expect(findingsFor(report, RULE_IDS.AISLE_WIDTH)).toHaveLength(0)
  })

  it('does not treat a bed clipping one end of a doorway as blocking it', () => {
    // A 1300mm sliding door with a bed platform overlapping its rearmost 200mm
    // still has most of an opening to step through. Measuring the worst point
    // rather than the best made this read as a blocked door.
    const aperture: VanObstacle = {
      id: 'side-door',
      vanModelId: 'test-van',
      kind: 'aperture_side',
      name: 'Sliding door aperture',
      position: { x: 1690, y: 700, z: 0 },
      size: { w: 60, d: 1300, h: 1700 },
      articulation: null,
      confidence: 'approximate',
    }

    const bed = object({
      name: 'Bed',
      position: { x: 0, y: 1800, z: 300 },
      size: { w: 1700, d: 1200, h: 500 },
    })

    const report = run([bed], { van: van({ obstacles: [aperture] }) })
    expect(findingsFor(report, RULE_IDS.DOOR_EGRESS)).toHaveLength(0)
  })

  it('does flag a doorway with something parked right across it', () => {
    const aperture: VanObstacle = {
      id: 'side-door',
      vanModelId: 'test-van',
      kind: 'aperture_side',
      name: 'Sliding door aperture',
      position: { x: 1690, y: 700, z: 0 },
      size: { w: 60, d: 1300, h: 1700 },
      articulation: null,
      confidence: 'approximate',
    }

    const galley = object({
      name: 'Galley',
      position: { x: 1300, y: 600, z: 0 },
      size: { w: 380, d: 1500, h: 900 },
    })

    const report = run([galley], { van: van({ obstacles: [aperture] }) })
    expect(findingsFor(report, RULE_IDS.DOOR_EGRESS)).toHaveLength(1)
  })

  it('flags an overhead locker that kills standing headroom', () => {
    const report = run([
      object({ name: 'Overhead', position: { x: 0, y: 0, z: 1400 }, size: { w: 1750, d: 3100, h: 500 } }),
    ])
    const headroom = findingsFor(report, RULE_IDS.STANDING_HEADROOM)
    expect(headroom).toHaveLength(1)
    expect(headroom[0]?.measured?.value).toBe(1400)
  })
})

describe('weight and axle load', () => {
  it('sums total build mass including loose items', () => {
    const objects = [
      object({ mass: 100_000 }),
      object({ mass: 50_000, kind: 'loose' }),
    ]
    const load = summariseLoad(buildContext(van(), objects, settings()))
    expect(load.total).toBe(150_000)
  })

  it('puts mass over the rear axle onto the rear axle', () => {
    // 100kg sitting exactly on the rear axle should land entirely on it.
    const onRearAxle = object({
      mass: 100_000,
      position: { x: 0, y: 2500, z: 0 },
      size: { w: 400, d: 400, h: 400 },
    })
    const load = summariseLoad(buildContext(van(), [onRearAxle], settings()))

    expect(load.rearAxle - van().kerbRearAxle).toBeCloseTo(100_000, -2)
    expect(load.frontAxle - van().kerbFrontAxle).toBeCloseTo(0, -2)
  })

  it('splits mass at the middle of the wheelbase evenly', () => {
    const midpoint = (-800 + 2700) / 2
    const centred = object({
      mass: 100_000,
      position: { x: 0, y: midpoint - 200, z: 0 },
      size: { w: 400, d: 400, h: 400 },
    })
    const load = summariseLoad(buildContext(van(), [centred], settings()))

    expect(load.rearAxle - van().kerbRearAxle).toBeCloseTo(50_000, -2)
    expect(load.frontAxle - van().kerbFrontAxle).toBeCloseTo(50_000, -2)
  })

  it('raises an error once the build exceeds payload', () => {
    const report = run([object({ mass: 1_200_000 })])
    const payload = findingsFor(report, RULE_IDS.TOTAL_PAYLOAD)
    expect(payload).toHaveLength(1)
    expect(payload[0]?.severity).toBe('error')
  })

  it('warns before payload runs out, not only after', () => {
    const report = run([object({ mass: 850_000 })])
    const payload = findingsFor(report, RULE_IDS.TOTAL_PAYLOAD)
    expect(payload).toHaveLength(1)
    expect(payload[0]?.severity).toBe('warning')
  })
})

describe('engine', () => {
  it('skips rules the user has switched off', () => {
    const objects = [
      object({ position: { x: 0, y: 0, z: 0 }, size: { w: 600, d: 600, h: 600 } }),
      object({ position: { x: 100, y: 100, z: 0 }, size: { w: 600, d: 600, h: 600 } }),
    ]

    const on = run(objects)
    expect(findingsFor(on, RULE_IDS.OBJECT_OVERLAP)).toHaveLength(1)

    const off = run(objects, {
      settings: settings({ disabledRules: [RULE_IDS.OBJECT_OVERLAP] }),
    })
    expect(findingsFor(off, RULE_IDS.OBJECT_OVERLAP)).toHaveLength(0)
    expect(off.skipped).toContain(RULE_IDS.OBJECT_OVERLAP)
  })

  it('keeps evaluating after one rule throws', () => {
    const exploding = {
      id: 'exploding',
      name: 'Exploding rule',
      description: 'Throws.',
      severity: 'error' as const,
      layer: 'structure' as const,
      evaluate() {
        throw new Error('boom')
      },
    }

    const report = run(
      [
        object({ position: { x: 0, y: 0, z: 0 }, size: { w: 600, d: 600, h: 600 } }),
        object({ position: { x: 100, y: 100, z: 0 }, size: { w: 600, d: 600, h: 600 } }),
      ],
      { rules: [exploding, ...ALL_RULES] },
    )

    expect(findingsFor(report, RULE_IDS.OBJECT_OVERLAP)).toHaveLength(1)
  })

  it('sorts errors above warnings', () => {
    const report = run([
      object({ name: 'A', position: { x: 0, y: 0, z: 0 }, size: { w: 600, d: 600, h: 600 } }),
      object({ name: 'B', position: { x: 100, y: 100, z: 0 }, size: { w: 600, d: 600, h: 600 }, mass: 900_000 }),
    ])

    const severities = report.findings.map((finding) => finding.severity)
    expect(severities.indexOf('error')).toBeLessThan(severities.lastIndexOf('warning'))
  })

  it('registers every rule id declared in constants', () => {
    // Rule ids are persisted in user settings, so a rule that exists in the
    // constants but not the registry would silently never run.
    for (const id of Object.values(RULE_IDS)) {
      expect(ruleById(id), `rule ${id} is not registered`).toBeDefined()
    }
  })
})
