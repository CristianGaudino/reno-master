import { describe, expect, it } from 'vitest'
import { CATEGORY_LAYER, RULE_IDS } from './constants'
import type { ResolvedVan, UserSettings, VanObject } from './definitions'
import { buildContext, evaluateScene } from './rules'
import { ALL_RULES } from './rules/registry'
import { inferRuns, layerOf, runLength } from './systems'
import { instantiateTemplate, TEMPLATES, templateById } from './templates'

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
    category: 'storage',
    kind: 'fixed',
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
    catalogSlug: null,
    ...overrides,
  }
}

const settings: UserSettings = {
  userId: 'user',
  heightMm: null,
  unitSystem: 'metric',
  disabledRules: [],
  gridMm: 10,
  ghostingEnabled: true,
  snapToObjects: true,
}

describe('layers', () => {
  it('puts every category on a layer', () => {
    for (const category of Object.keys(CATEGORY_LAYER)) {
      expect(CATEGORY_LAYER[category as keyof typeof CATEGORY_LAYER]).toBeDefined()
    }
  })

  it('files an object by its category', () => {
    expect(layerOf(object({ category: 'electrical' }))).toBe('electrical')
    expect(layerOf(object({ category: 'water' }))).toBe('plumbing')
    expect(layerOf(object({ category: 'sleeping' }))).toBe('structure')
  })
})

describe('system runs', () => {
  it('measures a right-angled route, not a straight line', () => {
    // Cable follows the van rather than flying across it, and a straight line
    // would understate the copper you actually have to pull.
    const a = object({ position: { x: 0, y: 0, z: 0 }, size: { w: 100, d: 100, h: 100 } })
    const b = object({ position: { x: 300, y: 400, z: 0 }, size: { w: 100, d: 100, h: 100 } })
    expect(runLength(a, b)).toBe(700)
  })

  it('links consumers to the battery', () => {
    const battery = object({ name: 'Leisure battery', category: 'electrical' })
    const fridge = object({ name: 'Compressor fridge', category: 'kitchen' })
    const bed = object({ name: 'Bed', category: 'sleeping' })

    const runs = inferRuns([battery, fridge, bed])
    expect(runs).toHaveLength(1)
    expect(runs[0]?.to.id).toBe(fridge.id)
    expect(runs[0]?.system).toBe('dc')
  })

  it('routes water through the pump when there is one', () => {
    const tank = object({ name: 'Fresh water tank', category: 'water' })
    const pump = object({ name: 'Water pump', category: 'water' })
    const sink = object({ name: 'Sink', category: 'kitchen' })

    const runs = inferRuns([tank, pump, sink])
    const toSink = runs.find((run) => run.to.id === sink.id)

    expect(toSink?.from.id).toBe(pump.id)
    expect(runs.some((run) => run.from.id === tank.id && run.to.id === pump.id)).toBe(true)
  })

  it('stays quiet when there is no battery or tank to work from', () => {
    expect(inferRuns([object({ name: 'Compressor fridge' })])).toHaveLength(0)
  })

  it('warns about a long DC run and files it on the electrical layer', () => {
    const battery = object({
      name: 'Leisure battery',
      category: 'electrical',
      position: { x: 0, y: 0, z: 0 },
      size: { w: 300, d: 200, h: 200 },
    })
    // Opposite corner of the van and up at locker height: 1300 + 2650 + 1400 of
    // right-angled route, comfortably past the 5m mark.
    const fridge = object({
      name: 'Compressor fridge',
      category: 'kitchen',
      position: { x: 1200, y: 2500, z: 1200 },
      size: { w: 500, d: 500, h: 600 },
    })

    const report = evaluateScene(buildContext(van(), [battery, fridge], settings), ALL_RULES)
    const finding = report.findings.find(
      (candidate) => candidate.ruleId === RULE_IDS.DC_RUN_LENGTH,
    )

    expect(finding).toBeDefined()
    expect(finding?.layer).toBe('electrical')
    expect(finding?.objectIds).toEqual(expect.arrayContaining([battery.id, fridge.id]))
  })

  it('leaves a short DC run alone', () => {
    const battery = object({
      name: 'Leisure battery',
      category: 'electrical',
      position: { x: 0, y: 0, z: 0 },
      size: { w: 300, d: 200, h: 200 },
    })
    const fridge = object({
      name: 'Compressor fridge',
      category: 'kitchen',
      position: { x: 400, y: 400, z: 0 },
      size: { w: 500, d: 500, h: 600 },
    })

    const report = evaluateScene(buildContext(van(), [battery, fridge], settings), ALL_RULES)
    expect(
      report.findings.some((candidate) => candidate.ruleId === RULE_IDS.DC_RUN_LENGTH),
    ).toBe(false)
  })
})

/** A wheel arch, so 'on the arches' resolves to a real platform height. */
const wheelWell = (side: string, x: number): ResolvedVan['obstacles'][number] => ({
  id: `well-${side}`,
  vanModelId: 'test-van',
  kind: 'wheel_well',
  name: `${side} wheel well`,
  position: { x, y: 2350, z: 0 },
  size: { w: 205, d: 1010, h: 300 },
  articulation: null,
  confidence: 'approximate',
})

describe('templates', () => {
  it('fits every template into every seeded van shape', () => {
    // Anchors, not coordinates: the same template has to produce something
    // sensible in a short low van and a long high one.
    const shapes: ResolvedVan[] = [
      van({ interior: { w: 1750, d: 3100, h: 1900 } }),
      van({ interior: { w: 1866, d: 3800, h: 1930 } }),
      van({ interior: { w: 1700, d: 2555, h: 1406 } }),
    ]

    for (const template of TEMPLATES) {
      for (const shape of shapes) {
        const objects = instantiateTemplate(template, shape, 'project')
        expect(objects.length, `${template.id} produced nothing`).toBeGreaterThan(0)

        for (const object of objects) {
          expect(object.position.x, `${template.id}/${object.name} x`).toBeGreaterThanOrEqual(0)
          expect(object.position.y, `${template.id}/${object.name} y`).toBeGreaterThanOrEqual(0)
          expect(object.position.z, `${template.id}/${object.name} z`).toBeGreaterThanOrEqual(0)
          // Nothing should be wider than the van it was fitted to.
          expect(object.size.w).toBeLessThanOrEqual(shape.interior.w)
        }
      }
    }
  })

  it('anchors a rear-anchored item to the back of the van', () => {
    const shape = van({ interior: { w: 1750, d: 3100, h: 1900 } })
    const objects = instantiateTemplate(templateById('weekender')!, shape, 'project')
    const bed = objects.find((object) => object.category === 'sleeping')!

    expect(bed.position.y + bed.size.d).toBe(shape.interior.d)
  })

  it('gives every object a fresh id, so a template forks rather than links', () => {
    const shape = van()
    const first = instantiateTemplate(templateById('weekender')!, shape, 'project')
    const second = instantiateTemplate(templateById('weekender')!, shape, 'project')

    const firstIds = new Set(first.map((object) => object.id))
    for (const object of second) expect(firstIds.has(object.id)).toBe(false)
  })

  it('lays a run out nose to tail without items colliding', () => {
    // The point of runs: a galley and a fridge down the same wall queue up
    // instead of landing on top of each other in a short van.
    const shape = van({
      interior: { w: 1787, d: 3265, h: 1940 },
      obstacles: [wheelWell('left', 0), wheelWell('right', 1582)],
    })

    for (const template of TEMPLATES) {
      const objects = instantiateTemplate(template, shape, 'project')
      const context = buildContext(shape, objects, settings)
      const report = evaluateScene(context, ALL_RULES)

      const overlaps = report.findings.filter(
        (finding) => finding.ruleId === RULE_IDS.OBJECT_OVERLAP,
      )

      expect(
        overlaps.map((finding) => finding.message),
        `${template.id} overlaps in a Sprinter 144`,
      ).toEqual([])
    }
  })

  it('carries articulation through, so template doors still get checked', () => {
    const objects = instantiateTemplate(templateById('weekender')!, van(), 'project')
    const fridge = objects.find((object) => object.kind === 'articulated')

    expect(fridge?.articulation).not.toBeNull()
  })
})
