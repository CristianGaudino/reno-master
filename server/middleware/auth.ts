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

/**
 * Header that lets a caller pick its own identity while auth is stubbed.
 *
 * Test runs would otherwise share the account a developer is using, and they
 * create and delete projects freely — which is how a real account ends up with
 * three hundred fixtures called "Tank mass" in it.
 *
 * This grants nothing that is not already granted: there is no authentication
 * at all yet, so every caller is the same user regardless. It disappears with
 * the rest of this stub when Clerk arrives, and the identity it selects is
 * namespaced so it can never collide with a real one.
 */
const DEV_IDENTITY_HEADER = 'x-dev-identity'

export const auth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const requested = c.req.header(DEV_IDENTITY_HEADER)
  const externalId = requested ? `dev-scoped:${requested}` : devUserId()

  let userId = userIdCache.get(externalId)
  if (!userId) {
    userId = await ensureUser(externalId)
    userIdCache.set(externalId, userId)
  }

  c.set('userId', userId)
  c.set('externalId', externalId)

  await next()
})
