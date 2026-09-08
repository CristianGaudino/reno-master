/**
 * The sync endpoint's write path. SERVER ONLY.
 *
 * The editor is local-first: every edit lands in IndexedDB immediately, and this
 * runs only on the periodic checkpoint (or when the user forces a save). So a
 * request here carries a delta covering minutes of work, not a single drag —
 * which is exactly why the normalised schema pays off, since only the handful of
 * objects that actually changed are written.
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { projectObjects, projects } from '../db/schema'
import { objectToRow } from '../db/mappers'
import type { SyncRequest, SyncResponse, VanObject } from '../definitions'

/**
 * Apply a delta, refusing it if the client built on a stale revision.
 *
 * The revision guard is what stops a second tab or a second device silently
 * clobbering work: the caller gets a conflict back and the UI asks the user
 * which version to keep, rather than one of them quietly disappearing.
 *
 * Ordering note: the guarded bump runs before the writes, so if the process dies
 * between the two the next sync sees a revision it does not expect and returns a
 * conflict. That is a spurious prompt, not lost work — the client still holds
 * everything in IndexedDB. The alternative ordering (write first, bump second)
 * fails the other way and can half-apply a delta over someone else's changes,
 * which is worse.
 */
export async function applySync(
  userId: string,
  projectId: string,
  request: SyncRequest,
): Promise<SyncResponse> {
  const bumped = await db()
    .update(projects)
    .set({
      revision: sql`${projects.revision} + 1`,
      lastSyncId: request.syncId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.userId, userId),
        eq(projects.revision, request.baseRevision),
        isNull(projects.deletedAt),
      ),
    )
    .returning({ revision: projects.revision, updatedAt: projects.updatedAt })

  const result = bumped[0]
  if (!result) {
    // Either the revision moved under us, or the project is gone. Report the
    // current revision so the client can decide what to do.
    const current = await db()
      .select({ revision: projects.revision })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    return {
      ok: false,
      reason: 'conflict',
      serverRevision: current[0]?.revision ?? -1,
    }
  }

  await writeDelta(projectId, request.upserts, request.deletes)

  if (request.patch && Object.keys(request.patch).length > 0) {
    await applyProjectPatch(userId, projectId, request.patch)
  }

  return {
    ok: true,
    revision: result.revision,
    updatedAt: result.updatedAt.toISOString(),
  }
}

/**
 * Write the changed objects and remove the deleted ones.
 *
 * Both halves go through the batch API so they land in a single transaction and
 * a single round trip. Because object ids are generated on the client, the
 * upsert is idempotent — replaying a request after a dropped connection writes
 * the same rows rather than duplicating them.
 */
async function writeDelta(
  projectId: string,
  upserts: VanObject[],
  deletes: string[],
): Promise<void> {
  const statements = []

  if (upserts.length > 0) {
    // Reject anything claiming to belong to a different project: the id comes
    // from the client, so it is not to be trusted with routing.
    const rows = upserts
      .filter((object) => object.projectId === projectId)
      .map((object) => objectToRow(object))

    if (rows.length > 0) {
      statements.push(
        db()
          .insert(projectObjects)
          .values(rows)
          .onConflictDoUpdate({
            target: projectObjects.id,
            set: {
              name: sql`excluded.name`,
              category: sql`excluded.category`,
              kind: sql`excluded.kind`,
              posX: sql`excluded.pos_x`,
              posY: sql`excluded.pos_y`,
              posZ: sql`excluded.pos_z`,
              sizeW: sql`excluded.size_w`,
              sizeD: sql`excluded.size_d`,
              sizeH: sql`excluded.size_h`,
              yaw: sql`excluded.yaw`,
              mass: sql`excluded.mass`,
              cost: sql`excluded.cost`,
              color: sql`excluded.color`,
              articulation: sql`excluded.articulation`,
              connections: sql`excluded.connections`,
              zIndex: sql`excluded.z_index`,
              notes: sql`excluded.notes`,
              updatedAt: sql`excluded.updated_at`,
            },
            // Scoped to the project so a stray id cannot overwrite a row
            // belonging to someone else's build.
            setWhere: eq(projectObjects.projectId, projectId),
          }),
      )
    }
  }

  if (deletes.length > 0) {
    statements.push(
      db()
        .delete(projectObjects)
        .where(
          and(
            eq(projectObjects.projectId, projectId),
            inArray(projectObjects.id, deletes),
          ),
        ),
    )
  }

  if (statements.length === 0) return

  // `batch` sends the statements as one transaction in one HTTP request, which
  // matters on the serverless driver where every round trip is a new request.
  await db().batch(statements as [(typeof statements)[number], ...typeof statements])
}

async function applyProjectPatch(
  userId: string,
  projectId: string,
  patch: NonNullable<SyncRequest['patch']>,
): Promise<void> {
  const values: Record<string, unknown> = {}

  if (patch.name !== undefined) values.name = patch.name
  if (patch.vanModelId !== undefined) values.vanModelId = patch.vanModelId
  if (patch.overrides !== undefined) values.overrides = patch.overrides
  if (patch.customInterior !== undefined) {
    values.customInteriorW = patch.customInterior?.w ?? null
    values.customInteriorD = patch.customInterior?.d ?? null
    values.customInteriorH = patch.customInterior?.h ?? null
  }

  if (Object.keys(values).length === 0) return

  await db()
    .update(projects)
    .set(values)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
}
