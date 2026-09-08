/**
 * Wire contracts, defined once and shared by both sides.
 *
 * The server validates every request body against these; the client infers its
 * types from the same schemas. A field that changes shape therefore breaks the
 * build on both sides rather than failing at runtime in front of a user.
 */

import { z } from 'zod'
import { OBJECT_CATEGORIES } from './domain'

const mm = z.number().finite()
const grams = z.number().finite().nonnegative()

export const vec3Schema = z.object({ x: mm, y: mm, z: mm })
export const size3Schema = z.object({
  w: mm.positive(),
  d: mm.positive(),
  h: mm.positive(),
})

export const articulationSchema = z.object({
  kind: z.enum(['hinge', 'slide', 'swivel', 'fold']),
  hinge: z.object({ x: mm, y: mm }),
  leafLength: mm.positive(),
  leafThickness: mm.nonnegative(),
  startAngle: z.number().finite(),
  sweepAngle: z.number().finite(),
  zRange: z.object({ min: mm, max: mm }),
  slideDistance: mm.nonnegative().optional(),
})

export const connectionPointSchema = z.object({
  id: z.string().min(1),
  system: z.enum(['dc', 'ac', 'water_fresh', 'water_grey', 'gas']),
  offset: vec3Schema,
  label: z.string().optional(),
})

export const vanObjectSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  category: z.enum(OBJECT_CATEGORIES),
  kind: z.enum(['fixed', 'articulated', 'loose']),
  position: vec3Schema,
  size: size3Schema,
  yaw: z.number().finite(),
  mass: grams,
  cost: z.number().finite().nonnegative(),
  color: z.string().max(32),
  articulation: articulationSchema.nullable(),
  connections: z.array(connectionPointSchema).default([]),
  zIndex: z.number().int(),
  notes: z.string().max(2000).nullable(),
})

export const taperPointSchema = z.object({
  z: mm,
  insetLeft: mm,
  insetRight: mm,
})

export const vanOverridesSchema = z.object({
  interior: size3Schema.partial().optional(),
  taper: z.array(taperPointSchema).optional(),
  payload: grams.optional(),
  obstacles: z
    .record(
      z.string(),
      z
        .object({
          position: vec3Schema.partial().optional(),
          size: size3Schema.partial().optional(),
        })
        .nullable(),
    )
    .optional(),
})

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  vanModelId: z.string().nullable().optional(),
  customInterior: size3Schema.nullable().optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  vanModelId: z.string().nullable().optional(),
  customInterior: size3Schema.nullable().optional(),
  overrides: vanOverridesSchema.optional(),
})

/**
 * The sync delta.
 *
 * `baseRevision` is the revision the client last saw. The server rejects a sync
 * built on a stale revision rather than overwriting, which is what stops a
 * second tab or device silently clobbering work — see the 409 response below.
 */
export const syncRequestSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  /**
   * Identifies this client's write so a fire-and-forget `pagehide` flush can be
   * recognised as our own next time the project loads.
   */
  syncId: z.string().uuid(),
  upserts: z.array(vanObjectSchema).max(500),
  deletes: z.array(z.string().uuid()).max(500),
  patch: updateProjectSchema.optional(),
})

export const syncOkSchema = z.object({
  ok: z.literal(true),
  revision: z.number().int(),
  updatedAt: z.string(),
})

export const syncConflictSchema = z.object({
  ok: z.literal(false),
  reason: z.literal('conflict'),
  /** The server's current state, so the client can offer keep-mine/load-theirs. */
  serverRevision: z.number().int(),
})

export const updateSettingsSchema = z.object({
  heightMm: mm.positive().nullable().optional(),
  unitSystem: z.enum(['metric', 'imperial']).optional(),
  disabledRules: z.array(z.string()).optional(),
  gridMm: mm.positive().optional(),
  ghostingEnabled: z.boolean().optional(),
  snapToObjects: z.boolean().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type SyncRequest = z.infer<typeof syncRequestSchema>
export type SyncOk = z.infer<typeof syncOkSchema>
export type SyncConflict = z.infer<typeof syncConflictSchema>
export type SyncResponse = SyncOk | SyncConflict
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
