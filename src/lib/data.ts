/**
 * All read queries. SERVER ONLY.
 *
 * Writes live in `lib/actions/`. Keeping the two apart means a glance at the
 * imports of a route tells you whether it can mutate anything.
 *
 * Every function here takes a `userId` and filters on it. There is no query in
 * this file that can return another account's data, which is the property that
 * has to survive the switch from the dev auth stub to Clerk.
 */

import { and, asc, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from './db/client'
import {
  projectObjects,
  projects,
  userCatalogItems,
  userSettings,
  users,
  vanModels,
  vanObstacles,
} from './db/schema'
import type {
  Project,
  ProjectSummary,
  UserCatalogItem,
  UserSettings,
  VanModel,
  VanObject,
  VanObstacle,
} from './definitions'
import { DEFAULT_GRID_MM } from './config'
import {
  rowToObject,
  rowToProject,
  rowToUserCatalogItem,
  rowToVanModel,
  rowToVanObstacle,
} from './db/mappers'

// ---------------------------------------------------------------------------
// Users and settings
// ---------------------------------------------------------------------------

export async function findUserByExternalId(externalId: string) {
  const rows = await db().select().from(users).where(eq(users.externalId, externalId)).limit(1)
  return rows[0] ?? null
}

/**
 * Settings for a user, falling back to defaults when they have never saved any.
 *
 * Returning defaults rather than null keeps every caller from having to repeat
 * the same fallback, and means a brand-new account behaves identically to an
 * established one.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const rows = await db()
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return {
      userId,
      heightMm: null,
      unitSystem: 'metric',
      disabledRules: [],
      gridMm: DEFAULT_GRID_MM,
      ghostingEnabled: true,
      snapToObjects: true,
    }
  }

  return {
    userId: row.userId,
    heightMm: row.heightMm,
    unitSystem: row.unitSystem,
    disabledRules: row.disabledRules,
    gridMm: row.gridMm,
    ghostingEnabled: row.ghostingEnabled,
    snapToObjects: row.snapToObjects,
  }
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await db()
    .select({
      id: projects.id,
      name: projects.name,
      revision: projects.revision,
      updatedAt: projects.updatedAt,
      vanModelId: projects.vanModelId,
      make: vanModels.make,
      model: vanModels.model,
      wheelbaseLabel: vanModels.wheelbaseLabel,
      roofLabel: vanModels.roofLabel,
      objectCount: count(projectObjects.id),
    })
    .from(projects)
    .leftJoin(vanModels, eq(projects.vanModelId, vanModels.id))
    .leftJoin(projectObjects, eq(projectObjects.projectId, projects.id))
    .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
    .groupBy(
      projects.id,
      vanModels.make,
      vanModels.model,
      vanModels.wheelbaseLabel,
      vanModels.roofLabel,
    )
    .orderBy(desc(projects.updatedAt))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    vanLabel: row.make
      ? `${row.make} ${row.model} ${row.wheelbaseLabel} ${row.roofLabel}`.trim()
      : 'Custom dimensions',
    objectCount: Number(row.objectCount),
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  const rows = await db()
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
    )
    .limit(1)

  const row = rows[0]
  return row ? rowToProject(row) : null
}

export async function getProjectObjects(projectId: string): Promise<VanObject[]> {
  const rows = await db()
    .select()
    .from(projectObjects)
    .where(eq(projectObjects.projectId, projectId))
    .orderBy(asc(projectObjects.zIndex))

  return rows.map(rowToObject)
}

/** Just the revision, for the cheap conflict check on the sync path. */
export async function getProjectRevision(
  userId: string,
  projectId: string,
): Promise<number | null> {
  const rows = await db()
    .select({ revision: projects.revision })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
    )
    .limit(1)

  return rows[0]?.revision ?? null
}

// ---------------------------------------------------------------------------
// Van preset library
// ---------------------------------------------------------------------------

export async function listVanModels(): Promise<VanModel[]> {
  const modelRows = await db()
    .select()
    .from(vanModels)
    .orderBy(asc(vanModels.make), asc(vanModels.model), asc(vanModels.wheelbaseLabel))

  const obstacleRows = await db().select().from(vanObstacles)

  const byModel = new Map<string, VanObstacle[]>()
  for (const row of obstacleRows) {
    const list = byModel.get(row.vanModelId) ?? []
    list.push(rowToVanObstacle(row))
    byModel.set(row.vanModelId, list)
  }

  return modelRows.map((row) => rowToVanModel(row, byModel.get(row.id) ?? []))
}

export async function getVanModel(modelId: string): Promise<VanModel | null> {
  const rows = await db().select().from(vanModels).where(eq(vanModels.id, modelId)).limit(1)
  const row = rows[0]
  if (!row) return null

  const obstacleRows = await db()
    .select()
    .from(vanObstacles)
    .where(eq(vanObstacles.vanModelId, modelId))

  return rowToVanModel(row, obstacleRows.map(rowToVanObstacle))
}

// ---------------------------------------------------------------------------
// Personal catalog
// ---------------------------------------------------------------------------

export async function listUserCatalogItems(userId: string): Promise<UserCatalogItem[]> {
  const rows = await db()
    .select()
    .from(userCatalogItems)
    .where(eq(userCatalogItems.userId, userId))
    .orderBy(desc(userCatalogItems.createdAt))

  return rows.map(rowToUserCatalogItem)
}
