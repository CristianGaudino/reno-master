/**
 * Authentication.
 *
 * Deliberately a stub: Clerk is planned but not wired up yet. Everything that
 * matters is arranged so that swapping it in is a change to this one file.
 *
 * To switch to Clerk:
 *   1. Verify the session token from the Authorization header (or Clerk's
 *      cookie) with the Clerk backend SDK.
 *   2. Use the resulting `sub` as `externalId` below.
 *   3. Delete `devUserId` and the DEV_USER_ID environment variable.
 *
 * Nothing else changes. `users.external_id` already exists to hold the Clerk
 * user id, `ensureUser` already handles first sight of an account, and every
 * query in `lib/data.ts` and `lib/actions/` already filters on the internal
 * user id this middleware resolves.
 */

import { createMiddleware } from 'hono/factory'
import { devUserId } from '../../src/lib/config.server'
import { ensureUser } from '../../src/lib/actions/settings'

export interface AuthVariables {
  userId: string
  externalId: string
}

/** Cache the id lookup per identity so warm invocations skip a round trip. */
const userIdCache = new Map<string, string>()

export const auth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const externalId = devUserId()

  let userId = userIdCache.get(externalId)
  if (!userId) {
    userId = await ensureUser(externalId)
    userIdCache.set(externalId, userId)
  }

  c.set('userId', userId)
  c.set('externalId', externalId)

  await next()
})
