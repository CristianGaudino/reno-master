/**
 * Exercise the Vercel function through Node's `(req, res)` signature.
 *
 * This is the one part of the stack that production runs and development does
 * not: locally the Hono app is served by `@hono/node-server`, while on Vercel it
 * goes through the adapter in `api/index.ts`. That difference is exactly where
 * a deployment breaks while every local check passes, so it gets its own smoke
 * test rather than being discovered in production.
 *
 * Run with `npm run smoke:api` against a seeded database.
 */

import '../server/env'
import { createServer } from 'node:http'
import handler from '../api/index'

const PORT = 9911
const server = createServer((req, res) => {
  void handler(req, res)
})

await new Promise<void>((resolve) => server.listen(PORT, resolve))
const base = `http://localhost:${PORT}`

let failures = 0

async function check(label: string, run: () => Promise<boolean>): Promise<void> {
  try {
    const ok = await run()
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}\n`)
    if (!ok) failures += 1
  } catch (error) {
    process.stdout.write(`  FAIL ${label} — ${(error as Error).message}\n`)
    failures += 1
  }
}

await check('GET /api/health', async () => {
  const response = await fetch(`${base}/api/health`)
  return response.status === 200 && (await response.json()).ok === true
})

await check('GET /api/van-models returns the seeded library', async () => {
  const response = await fetch(`${base}/api/van-models`)
  const body = (await response.json()) as { models: unknown[] }
  return response.status === 200 && body.models.length > 0
})

// The POST path is the one the hand-written body handling exists for.
await check('POST /api/projects accepts a JSON body', async () => {
  const response = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'API smoke test' }),
  })
  const body = (await response.json()) as { project?: { id: string } }
  return response.status === 201 && Boolean(body.project?.id)
})

await check('rejects a malformed id rather than throwing', async () => {
  const response = await fetch(`${base}/api/projects/not-a-uuid`)
  return response.status === 400
})

server.close()
process.stdout.write(failures === 0 ? '\nAPI adapter is healthy\n' : `\n${failures} failed\n`)
process.exit(failures === 0 ? 0 : 1)
