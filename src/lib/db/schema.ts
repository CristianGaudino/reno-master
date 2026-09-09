/**
 * Database schema.
 *
 * SERVER ONLY. An ESLint rule fails the build if anything under
 * `src/components`, `src/routes` or `src/store` imports this file — in a Vite
 * SPA that would ship the Neon driver and connection string to the browser.
 *
 * The scene is stored as normalised rows rather than one JSONB document. The
 * deciding factor is write churn: the editor commits a delta every few minutes,
 * and with a JSONB scene every commit would rewrite the whole document and leave
 * the previous version as a dead tuple. Normalised rows mean nudging one cabinet
 * writes roughly two hundred bytes. JSONB is kept only for genuinely polymorphic
 * leaves — `articulation`, whose fields differ per hinge/slide/swivel/fold, and
 * `connections`.
 *
 * All lengths are integer millimetres and all masses are grams.
 */

import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type {
  Articulation,
  ConnectionPoint,
  TaperPoint,
  VanOverrides,
} from '../definitions/domain'

export const confidenceEnum = pgEnum('confidence', [
  'verified',
  'approximate',
  'community',
])

export const objectKindEnum = pgEnum('object_kind', ['fixed', 'articulated', 'loose'])

export const objectCategoryEnum = pgEnum('object_category', [
  'sleeping',
  'kitchen',
  'seating',
  'storage',
  'utility',
  'electrical',
  'water',
])

export const obstacleKindEnum = pgEnum('obstacle_kind', [
  'wheel_well',
  'b_pillar',
  'aperture_side',
  'aperture_rear',
  'mount_point',
  'intrusion',
])

export const unitSystemEnum = pgEnum('unit_system', ['metric', 'imperial'])

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * The identity-provider subject. Clerk's user id slots straight in here
     * when auth is wired up; until then it holds the dev stand-in.
     */
    externalId: text('external_id').notNull().unique(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('users_external_id_idx').on(table.externalId)],
)

/** Spec section 8: settings persist across projects, not per project. */
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Null when the user has not told us their height; rules then report only the standard. */
  heightMm: integer('height_mm'),
  unitSystem: unitSystemEnum('unit_system').notNull().default('metric'),
  /** Rule ids the user has switched off. Every rule is individually toggleable. */
  disabledRules: text('disabled_rules').array().notNull().default([]),
  gridMm: integer('grid_mm').notNull().default(10),
  ghostingEnabled: boolean('ghosting_enabled').notNull().default(true),
  snapToObjects: boolean('snap_to_objects').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Van preset library (shared, seeded)
// ---------------------------------------------------------------------------

export const vanModels = pgTable('van_models', {
  /** Human-readable slug, e.g. `sprinter-144-high`. Stable across reseeds. */
  id: text('id').primaryKey(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  variant: text('variant').notNull().default(''),
  wheelbaseLabel: text('wheelbase_label').notNull(),
  roofLabel: text('roof_label').notNull(),

  interiorW: integer('interior_w').notNull(),
  interiorD: integer('interior_d').notNull(),
  interiorH: integer('interior_h').notNull(),

  /** Wall taper profile; vans are not boxes. */
  taper: jsonb('taper').$type<TaperPoint[]>().notNull().default([]),

  payload: integer('payload').notNull(),
  gvwr: integer('gvwr').notNull(),
  frontAxleY: integer('front_axle_y').notNull(),
  rearAxleY: integer('rear_axle_y').notNull(),
  kerbFrontAxle: integer('kerb_front_axle').notNull(),
  kerbRearAxle: integer('kerb_rear_axle').notNull(),

  /**
   * Provenance of these dimensions, surfaced in the UI. Spec section 3 flags
   * that accurate interior figures are not available in any clean public
   * source, so nothing is presented as fact that has not been verified.
   */
  confidence: confidenceEnum('confidence').notNull().default('approximate'),
  sourceNote: text('source_note'),
})

export const vanObstacles = pgTable(
  'van_obstacles',
  {
    id: text('id').primaryKey(),
    vanModelId: text('van_model_id')
      .notNull()
      .references(() => vanModels.id, { onDelete: 'cascade' }),
    kind: obstacleKindEnum('kind').notNull(),
    name: text('name').notNull(),

    posX: integer('pos_x').notNull(),
    posY: integer('pos_y').notNull(),
    posZ: integer('pos_z').notNull(),
    sizeW: integer('size_w').notNull(),
    sizeD: integer('size_d').notNull(),
    sizeH: integer('size_h').notNull(),

    /** Swing envelope for apertures that open. */
    articulation: jsonb('articulation').$type<Articulation | null>(),
    confidence: confidenceEnum('confidence').notNull().default('approximate'),
  },
  (table) => [index('van_obstacles_model_idx').on(table.vanModelId)],
)

/**
 * Pieces the user has saved for reuse across their own projects.
 *
 * Separate from the shared catalog on purpose: one builder's cut-down galley is
 * not a product anyone else should see, and the shared catalog stays something
 * we curate rather than a dumping ground.
 *
 * Articulation is not stored. It is inherited from `based_on_slug` when there is
 * one, which keeps a saved fridge-with-a-door working without having to convert
 * a placed object's absolute hinge back into a relative template.
 */
export const userCatalogItems = pgTable(
  'user_catalog_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    category: objectCategoryEnum('category').notNull(),
    kind: objectKindEnum('kind').notNull(),

    sizeW: integer('size_w').notNull(),
    sizeD: integer('size_d').notNull(),
    sizeH: integer('size_h').notNull(),
    mass: integer('mass').notNull().default(0),
    cost: integer('cost').notNull().default(0),
    color: text('color').notNull(),

    /** Catalog entry it was derived from, if any. */
    basedOnSlug: text('based_on_slug'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('user_catalog_user_idx').on(table.userId)],
)

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),

    /** Null for a custom-dimension project. */
    vanModelId: text('van_model_id').references(() => vanModels.id, {
      onDelete: 'set null',
    }),

    customInteriorW: integer('custom_interior_w'),
    customInteriorD: integer('custom_interior_d'),
    customInteriorH: integer('custom_interior_h'),

    /**
     * Per-project corrections to the chosen preset. Spec open question,
     * answered: these stay local to the project and never write back to the
     * shared library.
     */
    overrides: jsonb('overrides').$type<VanOverrides>().notNull().default({}),

    /**
     * Bumped on every successful sync. The client sends the revision it last
     * saw; a mismatch means someone else wrote in between, and the sync is
     * refused rather than silently overwriting their work.
     */
    revision: integer('revision').notNull().default(0),

    /**
     * Id of the client sync that last wrote here.
     *
     * A `pagehide` flush goes out via sendBeacon, which cannot report back — so
     * the client has no way to learn that its parting write landed, and would
     * otherwise see its own successful save as someone else's edit the next time
     * the project is opened. Comparing this against the id the client knows it
     * sent tells the two apart.
     */
    lastSyncId: text('last_sync_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('projects_user_idx').on(table.userId)],
)

export const projectObjects = pgTable(
  'project_objects',
  {
    /**
     * Generated on the client. That is what makes the sync upsert idempotent:
     * a retried request after a flaky connection writes the same rows rather
     * than duplicating them, and no id has to round-trip before the user can
     * carry on editing.
     */
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    category: objectCategoryEnum('category').notNull(),
    kind: objectKindEnum('kind').notNull(),

    posX: integer('pos_x').notNull(),
    posY: integer('pos_y').notNull(),
    posZ: integer('pos_z').notNull(),
    sizeW: integer('size_w').notNull(),
    sizeD: integer('size_d').notNull(),
    sizeH: integer('size_h').notNull(),
    /** Degrees; real rather than integer so 22.5-degree placements survive. */
    yaw: real('yaw').notNull().default(0),

    mass: integer('mass').notNull().default(0),
    cost: integer('cost').notNull().default(0),
    color: text('color').notNull(),

    /** Polymorphic by design — see the file header. */
    articulation: jsonb('articulation').$type<Articulation | null>(),
    connections: jsonb('connections').$type<ConnectionPoint[]>().notNull().default([]),

    zIndex: integer('z_index').notNull().default(0),
    notes: text('notes'),
    /** Catalog entry this was created from; null for a from-scratch object. */
    catalogSlug: text('catalog_slug'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('project_objects_project_idx').on(table.projectId)],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  projects: many(projects),
  catalogItems: many(userCatalogItems),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}))

export const projectsRelations = relations(projects, ({ many, one }) => ({
  objects: many(projectObjects),
  vanModel: one(vanModels, {
    fields: [projects.vanModelId],
    references: [vanModels.id],
  }),
  owner: one(users, { fields: [projects.userId], references: [users.id] }),
}))

export const projectObjectsRelations = relations(projectObjects, ({ one }) => ({
  project: one(projects, {
    fields: [projectObjects.projectId],
    references: [projects.id],
  }),
}))

export const vanModelsRelations = relations(vanModels, ({ many }) => ({
  obstacles: many(vanObstacles),
}))

export const vanObstaclesRelations = relations(vanObstacles, ({ one }) => ({
  model: one(vanModels, {
    fields: [vanObstacles.vanModelId],
    references: [vanModels.id],
  }),
}))
