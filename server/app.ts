/**
 * The API.
 *
 * One Hono app, mounted as a single Vercel serverless function in production and
 * run as a plain Node server in development — the same code path either way, so
 * there is no class of bug that only appears once deployed.
 *
 * This is the only layer that may import `lib/data` and `lib/actions`.
 *
 * `AppType` at the bottom is what gives the browser a typed client: the RPC
 * client infers argument and response types straight from these route
 * definitions, so changing a handler's shape breaks the call sites at compile
 * time rather than in front of a user.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import {
  createCatalogItemSchema,
  createProjectSchema,
  syncRequestSchema,
  updateProjectSchema,
  updateSettingsSchema,
} from '@/lib/definitions/api'
import {
  getProject,
  getProjectObjects,
  getUserSettings,
  listProjects,
  listUserCatalogItems,
  listVanModels,
} from '@/lib/data'
import {
  createProject,
  deleteProject,
  duplicateProject,
  updateProject,
} from '@/lib/actions/projects'
import { applySync } from '@/lib/actions/sync'
import { updateUserSettings } from '@/lib/actions/settings'
import { createCatalogItem, deleteCatalogItem } from '@/lib/actions/catalog'
import { auth, type AuthVariables } from './middleware/auth'

const app = new Hono<{ Variables: AuthVariables }>().basePath('/api')

app.use('*', logger())
app.use('*', cors())

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse()
  console.error('Unhandled API error', error)
  return c.json({ error: 'Internal error' }, 500)
})

const uuidParam = z.object({ id: z.string().uuid() })

export const routes = app
  .get('/health', (c) => c.json({ ok: true }))

  /**
   * The van preset library. Public and identical for everyone, so it skips auth
   * and is safe for the client to cache hard.
   */
  .get('/van-models', async (c) => {
    const models = await listVanModels()
    return c.json({ models })
  })

  .use('/projects/*', auth)
  .use('/projects', auth)
  .use('/settings', auth)
  .use('/catalog', auth)
  .use('/catalog/*', auth)

  /** Pieces the user has saved for reuse across their own projects. */
  .get('/catalog', async (c) => {
    const items = await listUserCatalogItems(c.get('userId'))
    return c.json({ items })
  })

  .post('/catalog', zValidator('json', createCatalogItemSchema), async (c) => {
    const item = await createCatalogItem(c.get('userId'), c.req.valid('json'))
    return c.json({ item }, 201)
  })

  .delete('/catalog/:id', zValidator('param', uuidParam), async (c) => {
    const deleted = await deleteCatalogItem(c.get('userId'), c.req.valid('param').id)
    if (!deleted) throw new HTTPException(404, { message: 'Piece not found' })
    return c.json({ ok: true })
  })

  .get('/settings', async (c) => {
    const settings = await getUserSettings(c.get('userId'))
    return c.json({ settings })
  })

  .patch('/settings', zValidator('json', updateSettingsSchema), async (c) => {
    const settings = await updateUserSettings(c.get('userId'), c.req.valid('json'))
    return c.json({ settings })
  })

  .get('/projects', async (c) => {
    const projects = await listProjects(c.get('userId'))
    return c.json({ projects })
  })

  .post('/projects', zValidator('json', createProjectSchema), async (c) => {
    const project = await createProject(c.get('userId'), c.req.valid('json'))
    return c.json({ project }, 201)
  })

  /** The whole scene: project, objects, and the resolved van in one round trip. */
  .get('/projects/:id', zValidator('param', uuidParam), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')

    const project = await getProject(userId, id)
    if (!project) throw new HTTPException(404, { message: 'Project not found' })

    const objects = await getProjectObjects(id)
    return c.json({ project, objects })
  })

  .patch(
    '/projects/:id',
    zValidator('param', uuidParam),
    zValidator('json', updateProjectSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const project = await updateProject(c.get('userId'), id, c.req.valid('json'))
      if (!project) throw new HTTPException(404, { message: 'Project not found' })
      return c.json({ project })
    },
  )

  .delete('/projects/:id', zValidator('param', uuidParam), async (c) => {
    const { id } = c.req.valid('param')
    const deleted = await deleteProject(c.get('userId'), id)
    if (!deleted) throw new HTTPException(404, { message: 'Project not found' })
    return c.json({ ok: true })
  })

  .post(
    '/projects/:id/duplicate',
    zValidator('param', uuidParam),
    zValidator('json', z.object({ name: z.string().min(1).max(120) })),
    async (c) => {
      const { id } = c.req.valid('param')
      const project = await duplicateProject(c.get('userId'), id, c.req.valid('json').name)
      if (!project) throw new HTTPException(404, { message: 'Project not found' })
      return c.json({ project }, 201)
    },
  )

  /**
   * The sync endpoint.
   *
   * Returns 409 with the server's revision when the client built its delta on a
   * stale base — the client still holds everything locally, so the UI can offer
   * a choice rather than silently discarding one side.
   */
  .post(
    '/projects/:id/sync',
    zValidator('param', uuidParam),
    zValidator('json', syncRequestSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const result = await applySync(c.get('userId'), id, c.req.valid('json'))
      return c.json(result, result.ok ? 200 : 409)
    },
  )

export type AppType = typeof routes
export default app
