/**
 * Row <-> domain conversion. SERVER ONLY.
 *
 * The database stores each coordinate as its own integer column, while the rest
 * of the app works in `{x, y, z}` / `{w, d, h}` objects. Doing that translation
 * in one place keeps the flat column shape out of the geometry and rules code,
 * which is where readability actually matters.
 */

import type { InferSelectModel } from 'drizzle-orm'
import type {
  Project,
  UserCatalogItem,
  VanModel,
  VanObject,
  VanObstacle,
} from '../definitions'
import type {
  projectObjects,
  projects,
  userCatalogItems,
  vanModels,
  vanObstacles,
} from './schema'

type ProjectRow = InferSelectModel<typeof projects>
type ObjectRow = InferSelectModel<typeof projectObjects>
type VanModelRow = InferSelectModel<typeof vanModels>
type UserCatalogRow = InferSelectModel<typeof userCatalogItems>
type ObstacleRow = InferSelectModel<typeof vanObstacles>

export function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    vanModelId: row.vanModelId,
    customInterior:
      row.customInteriorW !== null &&
      row.customInteriorD !== null &&
      row.customInteriorH !== null
        ? { w: row.customInteriorW, d: row.customInteriorD, h: row.customInteriorH }
        : null,
    overrides: row.overrides ?? {},
    revision: row.revision,
    lastSyncId: row.lastSyncId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function rowToObject(row: ObjectRow): VanObject {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    category: row.category,
    kind: row.kind,
    position: { x: row.posX, y: row.posY, z: row.posZ },
    size: { w: row.sizeW, d: row.sizeD, h: row.sizeH },
    yaw: row.yaw,
    mass: row.mass,
    cost: row.cost,
    color: row.color,
    articulation: row.articulation ?? null,
    connections: row.connections ?? [],
    zIndex: row.zIndex,
    notes: row.notes,
    catalogSlug: row.catalogSlug,
  }
}

/** Domain object to the flat column shape the sync upsert writes. */
export function objectToRow(object: VanObject) {
  return {
    id: object.id,
    projectId: object.projectId,
    name: object.name,
    category: object.category,
    kind: object.kind,
    posX: Math.round(object.position.x),
    posY: Math.round(object.position.y),
    posZ: Math.round(object.position.z),
    sizeW: Math.round(object.size.w),
    sizeD: Math.round(object.size.d),
    sizeH: Math.round(object.size.h),
    yaw: object.yaw,
    mass: Math.round(object.mass),
    cost: Math.round(object.cost),
    color: object.color,
    articulation: object.articulation,
    connections: object.connections,
    zIndex: object.zIndex,
    notes: object.notes,
    catalogSlug: object.catalogSlug,
    updatedAt: new Date(),
  }
}

export function rowToVanObstacle(row: ObstacleRow): VanObstacle {
  return {
    id: row.id,
    vanModelId: row.vanModelId,
    kind: row.kind,
    name: row.name,
    position: { x: row.posX, y: row.posY, z: row.posZ },
    size: { w: row.sizeW, d: row.sizeD, h: row.sizeH },
    articulation: row.articulation ?? null,
    confidence: row.confidence,
  }
}

export function rowToVanModel(row: VanModelRow, obstacles: VanObstacle[]): VanModel {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    variant: row.variant,
    wheelbaseLabel: row.wheelbaseLabel,
    roofLabel: row.roofLabel,
    interior: { w: row.interiorW, d: row.interiorD, h: row.interiorH },
    taper: row.taper ?? [],
    payload: row.payload,
    gvwr: row.gvwr,
    frontAxleY: row.frontAxleY,
    rearAxleY: row.rearAxleY,
    kerbFrontAxle: row.kerbFrontAxle,
    kerbRearAxle: row.kerbRearAxle,
    confidence: row.confidence,
    sourceNote: row.sourceNote,
    obstacles,
  }
}

export function rowToUserCatalogItem(row: UserCatalogRow): UserCatalogItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    kind: row.kind,
    size: { w: row.sizeW, d: row.sizeD, h: row.sizeH },
    mass: row.mass,
    cost: row.cost,
    color: row.color,
    basedOnSlug: row.basedOnSlug,
    createdAt: row.createdAt.toISOString(),
  }
}
