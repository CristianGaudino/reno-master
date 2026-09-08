/**
 * Settings and account write queries. SERVER ONLY.
 */

import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { userSettings, users } from '../db/schema'
import { DEFAULT_GRID_MM } from '../config'
import type { UpdateSettingsInput, UserSettings } from '../definitions'

/**
 * Find or create the account for an identity-provider subject.
 *
 * This is the one place a user row is created. When Clerk replaces the dev auth
 * stub, `externalId` becomes the Clerk user id and nothing else here changes.
 */
export async function ensureUser(externalId: string, email?: string): Promise<string> {
  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.externalId, externalId))
    .limit(1)

  const found = existing[0]
  if (found) return found.id

  const created = await db()
    .insert(users)
    .values({ externalId, email: email ?? null })
    // Concurrent first requests from the same new account would otherwise race;
    // the unique index turns that into an upsert rather than an error.
    .onConflictDoUpdate({
      target: users.externalId,
      set: { externalId },
    })
    .returning({ id: users.id })

  return created[0]!.id
}

export async function updateUserSettings(
  userId: string,
  patch: UpdateSettingsInput,
): Promise<UserSettings> {
  const insertValues = {
    userId,
    heightMm: patch.heightMm ?? null,
    unitSystem: patch.unitSystem ?? ('metric' as const),
    disabledRules: patch.disabledRules ?? [],
    gridMm: patch.gridMm ?? DEFAULT_GRID_MM,
    ghostingEnabled: patch.ghostingEnabled ?? true,
    snapToObjects: patch.snapToObjects ?? true,
    updatedAt: new Date(),
  }

  // Only the keys the caller actually sent are updated, so a partial save from
  // one settings panel cannot reset fields owned by another.
  const updateValues: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.heightMm !== undefined) updateValues.heightMm = patch.heightMm
  if (patch.unitSystem !== undefined) updateValues.unitSystem = patch.unitSystem
  if (patch.disabledRules !== undefined) updateValues.disabledRules = patch.disabledRules
  if (patch.gridMm !== undefined) updateValues.gridMm = patch.gridMm
  if (patch.ghostingEnabled !== undefined) updateValues.ghostingEnabled = patch.ghostingEnabled
  if (patch.snapToObjects !== undefined) updateValues.snapToObjects = patch.snapToObjects

  const rows = await db()
    .insert(userSettings)
    .values(insertValues)
    .onConflictDoUpdate({ target: userSettings.userId, set: updateValues })
    .returning()

  const row = rows[0]!
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
