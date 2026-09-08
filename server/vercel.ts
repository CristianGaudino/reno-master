/**
 * Vercel entrypoint.
 *
 * Bundled by `npm run build:api` into `api/index.js`, which Vercel picks up as a
 * single serverless function; `vercel.json` rewrites every /api/* path to it.
 *
 * Bundling rather than shipping raw TypeScript is deliberate: it resolves the
 * `@/` path alias at build time instead of relying on the platform's TypeScript
 * resolution, which does not reliably honour tsconfig paths.
 */

import { handle } from 'hono/vercel'
import app from './app'

export const config = { runtime: 'nodejs' }

export default handle(app)
