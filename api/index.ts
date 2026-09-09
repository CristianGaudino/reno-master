/**
 * Vercel serverless entrypoint.
 *
 * Committed as TypeScript rather than generated, because Vercel discovers
 * functions from the files in the repository. The previous setup bundled this
 * with esbuild into a git-ignored `api/index.js` during the build, so there was
 * nothing in the source tree to discover — the deployment came up with a working
 * front end and every `/api/*` request falling through to the SPA.
 *
 * The whole server import graph uses relative paths for the same reason: the
 * platform compiles this file itself, and its TypeScript resolution does not
 * reliably honour tsconfig path aliases.
 */

import { handle } from 'hono/vercel'
import app from '../server/app'

export const config = { runtime: 'nodejs' }

export default handle(app)
