/**
 * Light systems modelling (spec section 7).
 *
 * Not schematics. The goal is to catch the obvious mistakes — the battery at the
 * far end of the van from everything it feeds, the pump nowhere near the tank —
 * by working out what plausibly connects to what and how far the run actually
 * has to travel.
 *
 * Two deliberate simplifications, both stated where they matter:
 *
 *  - Links are *inferred* from what is in the van rather than drawn by the user.
 *    A build has one battery bank and one fresh tank in almost every case, so
 *    guessing correctly is easy, and asking someone to wire up a schematic before
 *    they can be told their cable run is too long would defeat the point.
 *
 *  - Runs are measured as right-angled paths, not straight lines. Cable and pipe
 *    follow the van — along a wall, up a batten, across the ceiling — so a
 *    diagonal through the middle of the load space understates real length by a
 *    long way, and it is real length that decides voltage drop.
 */

import { CATEGORY_LAYER } from './constants'
import type { Mm, RuleLayer, VanObject } from './definitions'

export type SystemKind = 'dc' | 'water'

export interface SystemRun {
  id: string
  system: SystemKind
  layer: RuleLayer
  from: VanObject
  to: VanObject
  /** Right-angled run length in millimetres. */
  length: Mm
  /** Human-readable role, e.g. "battery to fridge". */
  label: string
}

/** Centre of an object, which is where a run is measured from. */
export function centreOf(object: VanObject): { x: Mm; y: Mm; z: Mm } {
  return {
    x: object.position.x + object.size.w / 2,
    y: object.position.y + object.size.d / 2,
    z: object.position.z + object.size.h / 2,
  }
}

/**
 * Length of a right-angled route between two objects.
 *
 * Manhattan distance in three axes. Cable does not fly across the load space; it
 * runs along the van and up the walls, and using a straight line here would make
 * every DC run look comfortably shorter than the one you actually have to pull.
 */
export function runLength(a: VanObject, b: VanObject): Mm {
  const from = centreOf(a)
  const to = centreOf(b)
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + Math.abs(to.z - from.z)
}

/** Objects that draw current and are worth measuring a cable run to. */
const DC_CONSUMER_SLUGS = /fridge|heater|pump|inverter|fan|light|controller|panel/i

function isBattery(object: VanObject): boolean {
  return object.category === 'electrical' && /batter/i.test(object.name)
}

function isFreshTank(object: VanObject): boolean {
  return object.category === 'water' && /fresh|water tank/i.test(object.name)
}

function isPump(object: VanObject): boolean {
  return /pump/i.test(object.name)
}

function isDcConsumer(object: VanObject): boolean {
  if (isBattery(object)) return false
  if (object.category === 'electrical') return true
  return DC_CONSUMER_SLUGS.test(object.name)
}

/** Water fittings the fresh supply has to reach. */
function isWaterOutlet(object: VanObject): boolean {
  if (isFreshTank(object)) return false
  return object.category === 'water' || /sink|tap|shower|heater/i.test(object.name)
}

/**
 * Work out the runs implied by what is in the van.
 *
 * Everything electrical hangs off the battery; everything plumbed hangs off the
 * fresh tank, via the pump when there is one. With no battery or no tank there
 * is nothing to measure, and the systems rules simply stay quiet rather than
 * inventing a topology.
 */
export function inferRuns(objects: VanObject[]): SystemRun[] {
  const runs: SystemRun[] = []

  // --- DC -----------------------------------------------------------------
  const batteries = objects.filter(isBattery)
  const battery = batteries[0]

  if (battery) {
    for (const object of objects) {
      if (object.id === battery.id) continue
      if (!isDcConsumer(object)) continue

      runs.push({
        id: `dc:${battery.id}:${object.id}`,
        system: 'dc',
        layer: 'electrical',
        from: battery,
        to: object,
        length: runLength(battery, object),
        label: `${battery.name} to ${object.name}`,
      })
    }

    // A second battery is part of the same bank and wants to be beside the first.
    for (const other of batteries.slice(1)) {
      runs.push({
        id: `dc:bank:${battery.id}:${other.id}`,
        system: 'dc',
        layer: 'electrical',
        from: battery,
        to: other,
        length: runLength(battery, other),
        label: `${battery.name} to ${other.name}`,
      })
    }
  }

  // --- Water --------------------------------------------------------------
  const tank = objects.find(isFreshTank)

  if (tank) {
    const pump = objects.find(isPump)

    // Tank to pump, then pump to everything it feeds. Without a pump the tank
    // feeds the outlets directly, which is a gravity system and equally valid.
    const source = pump ?? tank

    if (pump) {
      runs.push({
        id: `water:${tank.id}:${pump.id}`,
        system: 'water',
        layer: 'plumbing',
        from: tank,
        to: pump,
        length: runLength(tank, pump),
        label: `${tank.name} to ${pump.name}`,
      })
    }

    for (const object of objects) {
      if (object.id === tank.id || object.id === source.id) continue
      if (!isWaterOutlet(object)) continue

      runs.push({
        id: `water:${source.id}:${object.id}`,
        system: 'water',
        layer: 'plumbing',
        from: source,
        to: object,
        length: runLength(source, object),
        label: `${source.name} to ${object.name}`,
      })
    }
  }

  return runs
}

/** The layer an object is drawn on. */
export function layerOf(object: VanObject): RuleLayer {
  return CATEGORY_LAYER[object.category]
}
