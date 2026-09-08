/**
 * Environment-derived configuration. SERVER ONLY.
 *
 * Kept apart from `config.ts` because that file is imported by the browser
 * bundle, and anything touching `process.env` there would either fail to compile
 * against the DOM lib or, worse, inline a secret into a public asset. The ESLint
 * server-only guard covers this path alongside `lib/db` and `lib/actions`.
 */

/**
 * The Neon connection string.
 *
 * Throws rather than returning a blank so a misconfigured deployment fails
 * loudly on the first query, instead of quietly behaving as though the database
 * were empty.
 */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.',
    )
  }
  return url
}

/**
 * Dev-only stand-in for Clerk. Replaced wholesale when Clerk is wired up; see
 * `server/middleware/auth.ts`.
 */
export function devUserId(): string {
  return process.env.DEV_USER_ID ?? 'dev-user'
}

export function apiPort(): number {
  return Number(process.env.PORT ?? 8787)
}
