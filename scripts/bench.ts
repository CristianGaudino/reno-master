/**
 * Per-rule cost, measured rather than guessed.
 *
 * The rules run on every pointermove so the whole pass has to fit comfortably
 * inside a frame alongside React's render. Run with `npm run bench`.
 */

import { buildContext, evaluateScene } from '../src/lib/rules'
import { ALL_RULES } from '../src/lib/rules/registry'
import type { ResolvedVan, UserSettings, VanObject } from '../src/lib/definitions'

const van: ResolvedVan = {
  interior: { w: 1787, d: 3265, h: 1940 },
  taper: [
    { z: 0, insetLeft: 30, insetRight: 30 },
    { z: 700, insetLeft: 0, insetRight: 0 },
    { z: 1300, insetLeft: 55, insetRight: 55 },
    { z: 1940, insetLeft: 215, insetRight: 215 },
  ],
  payload: 1_180_000,
  gvwr: 3_500_000,
  frontAxleY: -700,
  rearAxleY: 2958,
  kerbFrontAxle: 1_280_000,
  kerbRearAxle: 1_040_000,
  obstacles: [],
  modelId: 'bench',
  label: 'Bench van',
  confidence: 'approximate',
  sourceNote: null,
  hasOverrides: false,
}

const settings: UserSettings = {
  userId: 'u',
  heightMm: 1700,
  unitSystem: 'metric',
  disabledRules: [],
  gridMm: 10,
  ghostingEnabled: true,
  snapToObjects: true,
}

function makeObjects(count: number): VanObject[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `o${i}`,
    projectId: 'p',
    name: `Object ${i}`,
    category: (i % 5 === 0 ? 'electrical' : i % 4 === 0 ? 'water' : 'storage') as VanObject['category'],
    kind: (i % 7 === 0 ? 'articulated' : 'fixed') as VanObject['kind'],
    position: { x: (i * 137) % 1200, y: (i * 311) % 2800, z: (i % 3) * 400 },
    size: { w: 300 + (i % 4) * 100, d: 300 + (i % 3) * 150, h: 400 },
    yaw: (i % 4) * 15,
    mass: 10_000,
    cost: 0,
    color: '#888',
    articulation:
      i % 7 === 0
        ? {
            kind: 'hinge' as const,
            hinge: { x: (i * 137) % 1200, y: (i * 311) % 2800 },
            leafLength: 500,
            leafThickness: 20,
            startAngle: 0,
            sweepAngle: 90,
            zRange: { min: 0, max: 800 },
          }
        : null,
    connections: [],
    zIndex: i,
    notes: null,
    catalogSlug: null,
  }))
}

function time(label: string, runs: number, fn: () => void): number {
  fn()
  const start = performance.now()
  for (let i = 0; i < runs; i++) fn()
  const ms = (performance.now() - start) / runs
  process.stdout.write(`  ${label.padEnd(26)} ${ms.toFixed(2)} ms\n`)
  return ms
}

for (const count of [20, 50, 100]) {
  process.stdout.write(`\n=== ${count} objects ===\n`)
  const objects = makeObjects(count)
  const ctx = buildContext(van, objects, settings)

  for (const rule of ALL_RULES) {
    time(rule.id, 20, () => rule.evaluate(ctx))
  }

  process.stdout.write('  ' + '-'.repeat(34) + '\n')
  time('WHOLE PASS', 20, () => evaluateScene(buildContext(van, objects, settings), ALL_RULES))
}
