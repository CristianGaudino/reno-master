/**
 * Personal catalog write queries. SERVER ONLY.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { userCatalogItems } from '../db/schema'
import { rowToUserCatalogItem } from '../db/mappers'
import type { CreateCatalogItemInput, UserCatalogItem } from '../definitions'

export async function createCatalogItem(
  userId: string,
  input: CreateCatalogItemInput,
): Promise<UserCatalogItem> {
  const rows = await db()
    .insert(userCatalogItems)
    .values({
      userId,
      name: input.name,
      category: input.category,
      kind: input.kind,
      sizeW: Math.round(input.size.w),
      sizeD: Math.round(input.size.d),
      sizeH: Math.round(input.size.h),
      mass: Math.round(input.mass),
      cost: Math.round(input.cost),
      color: input.color,
      basedOnSlug: input.basedOnSlug ?? null,
    })
    .returning()

  return rowToUserCatalogItem(rows[0]!)
}

export async function deleteCatalogItem(userId: string, id: string): Promise<boolean> {
  const rows = await db()
    .delete(userCatalogItems)
    .where(and(eq(userCatalogItems.id, id), eq(userCatalogItems.userId, userId)))
    .returning({ id: userCatalogItems.id })

  return rows.length > 0
}
