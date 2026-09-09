/**
 * Vercel serverless entrypoint.
 *
 * Bundled by `npm run build:api` into `api/index.js`, which is committed. Both
 * halves of that are load-bearing, and both were learned the hard way:
 *
 * **Committed**, because Vercel discovers functions from the files in the
 * repository, not from build output. Generating `api/index.js` during the build
 * left nothing to discover, and the deployment came up with a working front end
 * and every `/api/*` request falling through to the SPA shell.
 *
 * **Bundled**, because Vercel compiles a TypeScript entry but does not bundle
 * it, and this is an ESM package — so `import app from './app'` becomes an
 * extensionless relative import that Node cannot resolve:
 *
 *     Cannot find module '/var/task/server/app' imported from /var/task/api/index.js
 *
 * Bundling collapses the whole server graph into one file, leaving only bare
 * package specifiers, which resolve from node_modules without extensions. The
 * alternative was appending `.js` to every relative import across code the
 * browser shares.
 *
 * `npm run smoke:api` exercises this adapter over real HTTP, and CI checks the
 * committed bundle is current, so neither half can rot quietly.
 *
 * ## Why the adapter is written out by hand
 *
 * Hono's own `hono/vercel` helper returns a Web-standard `(Request) => Response`
 * handler. Whether a given Vercel Node runtime accepts one of those directly has
 * moved around, and this is a file that can only be tested by deploying it — a
 * slow and public way to find out you were wrong. The `(req, res)` signature
 * below is the oldest and most broadly supported thing the platform offers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type app from './app'

type HonoApp = typeof app

/**
 * The app is imported inside the handler rather than at module scope.
 *
 * A module that throws while loading gives Vercel nothing to report but
 * FUNCTION_INVOCATION_FAILED, which says only that something went wrong — and
 * the only way to test this file is to deploy it. Importing lazily means a load
 * failure is caught here and answered with the actual reason.
 */
let cached: HonoApp | null = null

async function getApp() {
  cached ??= (await import('./app')).default
  return cached
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  try {
    const app = await getApp()
    const response = await app.fetch(await toRequest(req))
    await writeResponse(res, response)
  } catch (error) {
    // Reaching here means the request never got as far as Hono's own error
    // handler — usually the app failing to load at all.
    const message = error instanceof Error ? error.message : String(error)
    console.error('Function invocation failed', error)

    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Internal error', reason: message }))
  }
}

/** Build a WHATWG Request from Node's incoming message. */
async function toRequest(req: IncomingMessage & { body?: unknown }): Promise<Request> {
  const proto = header(req, 'x-forwarded-proto') ?? 'https'
  const host = header(req, 'x-forwarded-host') ?? header(req, 'host') ?? 'localhost'
  const url = new URL(req.url ?? '/', `${proto}://${host}`)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const entry of value) headers.append(key, entry)
    else headers.set(key, value)
  }

  const method = req.method ?? 'GET'
  const init: RequestInit = { method, headers }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await readBody(req)
  }

  return new Request(url, init)
}

/**
 * Get the body, whichever way it arrives.
 *
 * Vercel parses JSON bodies before handing the request over, which consumes the
 * stream — so the already-parsed value has to be put back rather than read
 * again. A plain Node server does no such thing and leaves the stream intact.
 * Both happen: the second is how this is tested locally, the first is
 * production, and handling only one of them means every POST arrives empty
 * somewhere.
 */
async function readBody(
  req: IncomingMessage & { body?: unknown },
): Promise<BodyInit | undefined> {
  const parsed = req.body
  if (parsed !== undefined && parsed !== null) {
    if (typeof parsed === 'string') return parsed
    if (Buffer.isBuffer(parsed)) return new Uint8Array(parsed)
    return JSON.stringify(parsed)
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }

  if (chunks.length === 0) return undefined
  return new Uint8Array(Buffer.concat(chunks))
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status

  response.headers.forEach((value, key) => {
    // Set-Cookie is the one header that legitimately repeats.
    if (key.toLowerCase() === 'set-cookie') res.appendHeader(key, value)
    else res.setHeader(key, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  res.end(buffer)
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}
