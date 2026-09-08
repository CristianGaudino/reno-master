/**
 * Neon connection. SERVER ONLY — see the note in `schema.ts`.
 *
 * The HTTP driver is used rather than a TCP pool: serverless functions are
 * short-lived and a pool would spend its life being created and torn down. The
 * cost is that each query is its own request, which is why the sync endpoint
 * batches its writes into a single transaction rather than issuing one statement
 * per object.
 */

import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { databaseUrl } from '../config.server'
import * as schema from './schema'

let cached: ReturnType<typeof create> | null = null

/** Attempts, including the first. Two retries covers a compute cold start. */
const CONNECT_ATTEMPTS = 3
const RETRY_DELAYS_MS = [400, 1200]

/**
 * Retry connection-level failures.
 *
 * A Neon compute that has scaled to zero takes a few seconds to wake, and the
 * first request in can exceed the default connect timeout — which surfaced as
 * intermittent 500s on the very first page load after an idle period. Only
 * transport failures are retried; a query that reached the database and was
 * rejected is a real error and is thrown straight through.
 */
function retryingFetch(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  const attempt = async (remaining: number, delays: number[]): Promise<Response> => {
    try {
      return await fetch(input, init)
    } catch (error) {
      if (remaining <= 1) throw error
      const [delay = 1000, ...rest] = delays
      await new Promise((resolve) => setTimeout(resolve, delay))
      return attempt(remaining - 1, rest)
    }
  }

  return attempt(CONNECT_ATTEMPTS, RETRY_DELAYS_MS)
}

function create() {
  // `fetchFunction` is global driver config rather than a per-connection option.
  neonConfig.fetchFunction = retryingFetch
  const sql = neon(databaseUrl())
  return drizzle(sql, { schema, casing: 'snake_case' })
}

/**
 * Lazily created and memoised across warm invocations. Lazy matters: creating it
 * at module load would throw on a missing DATABASE_URL during the client build,
 * where this module is never actually called.
 */
export function db() {
  cached ??= create()
  return cached
}

export { schema }
