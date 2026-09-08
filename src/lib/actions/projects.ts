/**
 * Project write queries. SERVER ONLY.
 *
 * Reads live in `lib/data.ts`.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { projectObjects, projects } from '../db/schema'
import { rowToProject } from '../db/mappers'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../definitions'

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const rows = await db()
    .insert(projects)
    .values({
      userId,
      name: input.name,
      vanModelId: input.vanModelId ?? null,
      customInteriorW: input.customInterior?.w ?? null,
      customInteriorD: input.customInterior?.d ?? null,
      customInteriorH: input.customInterior?.h ?? null,
    })
    .returning()

  return rowToProject(rows[0]!)
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: UpdateProjectInput,
): Promise<Project | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() }

  if (patch.name !== undefined) values.name = patch.name
  if (patch.vanModelId !== undefined) values.vanModelId = patch.vanModelId
  if (patch.overrides !== undefined) values.overrides = patch.overrides
  if (patch.customInterior !== undefined) {
    values.customInteriorW = patch.customInterior?.w ?? null
    values.customInteriorD = patch.customInterior?.d ?? null
    values.customInteriorH = patch.customInterior?.h ?? null
  }

  const rows = await db()
    .update(projects)
    .set(values)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
    )
    .returning()

  const row = rows[0]
  return row ? rowToProject(row) : null
}

/**
 * Soft delete.
 *
 * A van build is months of work and the delete button sits next to the rename
 * button, so the row is kept and filtered out of reads rather than destroyed.
 */
export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const rows = await db()
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
    )
    .returning({ id: projects.id })

  return rows.length > 0
}

/**
 * Duplicate a project and everything in it.
 *
 * The objects are copied with fresh ids in one `INSERT ... SELECT`-shaped batch.
 * This is also the mechanism template forking will use when templates arrive
 * (build-order step 10): a template is a project, and loading one copies it with
 * no ongoing link to the source, exactly as spec section 5 requires.
 */
export async function duplicateProject(
  userId: string,
  projectId: string,
  name: string,
): Promise<Project | null> {
  const sourceRows = await db()
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
    )
    .limit(1)

  const source = sourceRows[0]
  if (!source) return null

  const createdRows = await db()
    .insert(projects)
    .values({
      userId,
      name,
      vanModelId: source.vanModelId,
      customInteriorW: source.customInteriorW,
      customInteriorD: source.customInteriorD,
      customInteriorH: source.customInteriorH,
      overrides: source.overrides,
    })
    .returning()

  const created = createdRows[0]!

  const sourceObjects = await db()
    .select()
    .from(projectObjects)
    .where(eq(projectObjects.projectId, projectId))

  if (sourceObjects.length > 0) {
    await db()
      .insert(projectObjects)
      .values(
        sourceObjects.map((object) => ({
          ...object,
          id: crypto.randomUUID(),
          projectId: created.id,
          updatedAt: new Date(),
        })),
      )
  }

  return rowToProject(created)
}
