/**
 * Environment loading for every Node entrypoint: the dev API server, the seed
 * script and drizzle-kit.
 *
 * `.env.local` takes precedence over `.env`. dotenv does not overwrite a
 * variable that is already defined, so listing it first is what gives it
 * priority — and it means Vercel's injected environment always wins over
 * anything left in a local file.
 *
 * Import this for its side effect, before anything that reads process.env.
 */

import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'], quiet: true })
