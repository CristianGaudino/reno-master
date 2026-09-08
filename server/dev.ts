/**
 * Local API server.
 *
 * Runs the same Hono app that Vercel serves in production, so development and
 * deployment share a code path. Vite proxies /api here (see vite.config.ts),
 * which keeps the browser on a single origin and avoids CORS in development.
 */

import './env'
import { serve } from '@hono/node-server'
import app from './app'
import { apiPort } from '@/lib/config.server'

const port = apiPort()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`)
})
