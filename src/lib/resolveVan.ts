/**
 * Combine a preset, a project's custom dimensions and its overrides into the
 * single van the editor draws and the rules run against.
 *
 * Overrides stay local to the project — spec section 3's open question, answered:
 * a correction you make to your Sprinter does not alter the shared library or
 * anyone else's project. That keeps the preset data honest about its provenance
 * while still letting you fix it for your own build.
 */

import {
  DEFAULT_CUSTOM_INTERIOR,
  DEFAULT_CUSTOM_PAYLOAD_G,
} from './config'
import type { Project, ResolvedVan, Size3, VanModel, VanObstacle } from './definitions'
import { vanModelLabel } from './vans'

export function resolveVan(project: Project, model: VanModel | null): ResolvedVan {
  const overrides = project.overrides ?? {}

  if (!model) {
    const base: Size3 = project.customInterior ?? { ...DEFAULT_CUSTOM_INTERIOR }
    const interior: Size3 = {
      w: overrides.interior?.w ?? base.w,
      d: overrides.interior?.d ?? base.d,
      h: overrides.interior?.h ?? base.h,
    }

    return {
      interior,
      taper: overrides.taper ?? [],
      payload: overrides.payload ?? DEFAULT_CUSTOM_PAYLOAD_G,
      gvwr: 0,
      // Without a real vehicle behind it there is no axle geometry to speak of.
      // Placing the axles at the ends of the load area at least makes the
      // distribution figure directionally right rather than meaningless.
      frontAxleY: 0,
      rearAxleY: interior.d,
      kerbFrontAxle: 0,
      kerbRearAxle: 0,
      obstacles: [],
      modelId: null,
      label: 'Custom dimensions',
      confidence: 'community',
      sourceNote: 'Dimensions entered by you.',
      hasOverrides: Object.keys(overrides).length > 0,
    }
  }

  const interior: Size3 = {
    w: overrides.interior?.w ?? model.interior.w,
    d: overrides.interior?.d ?? model.interior.d,
    h: overrides.interior?.h ?? model.interior.h,
  }

  return {
    interior,
    taper: overrides.taper ?? model.taper,
    payload: overrides.payload ?? model.payload,
    gvwr: model.gvwr,
    frontAxleY: model.frontAxleY,
    rearAxleY: model.rearAxleY,
    kerbFrontAxle: model.kerbFrontAxle,
    kerbRearAxle: model.kerbRearAxle,
    obstacles: applyObstacleOverrides(model.obstacles, overrides.obstacles),
    modelId: model.id,
    label: vanModelLabel(model),
    confidence: model.confidence,
    sourceNote: model.sourceNote,
    hasOverrides: hasAnyOverride(project),
  }
}

/**
 * A `null` entry means the user deleted that obstacle from their project — some
 * vans have had the bulkhead or a pillar removed, and the tool should not insist
 * on structure that is no longer there.
 */
function applyObstacleOverrides(
  obstacles: VanObstacle[],
  overrides: Project['overrides']['obstacles'],
): VanObstacle[] {
  if (!overrides) return obstacles

  const result: VanObstacle[] = []

  for (const obstacle of obstacles) {
    const override = overrides[obstacle.id]
    if (override === null) continue
    if (!override) {
      result.push(obstacle)
      continue
    }

    result.push({
      ...obstacle,
      position: { ...obstacle.position, ...override.position },
      size: { ...obstacle.size, ...override.size },
      confidence: 'community',
    })
  }

  return result
}

function hasAnyOverride(project: Project): boolean {
  const overrides = project.overrides ?? {}
  return Boolean(
    overrides.interior ||
      overrides.taper ||
      overrides.payload !== undefined ||
      (overrides.obstacles && Object.keys(overrides.obstacles).length > 0),
  )
}
