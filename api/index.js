var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/definitions/domain.ts
var OBJECT_CATEGORIES;
var init_domain = __esm({
  "src/lib/definitions/domain.ts"() {
    "use strict";
    OBJECT_CATEGORIES = [
      "sleeping",
      "kitchen",
      "seating",
      "storage",
      "utility",
      "electrical",
      "water"
    ];
  }
});

// src/lib/definitions/api.ts
import { z } from "zod";
var mm, grams, vec3Schema, size3Schema, articulationSchema, connectionPointSchema, vanObjectSchema, taperPointSchema, vanOverridesSchema, createProjectSchema, updateProjectSchema, syncRequestSchema, syncOkSchema, syncConflictSchema, createCatalogItemSchema, updateSettingsSchema;
var init_api = __esm({
  "src/lib/definitions/api.ts"() {
    "use strict";
    init_domain();
    mm = z.number().finite();
    grams = z.number().finite().nonnegative();
    vec3Schema = z.object({ x: mm, y: mm, z: mm });
    size3Schema = z.object({
      w: mm.positive(),
      d: mm.positive(),
      h: mm.positive()
    });
    articulationSchema = z.object({
      kind: z.enum(["hinge", "slide", "swivel", "fold"]),
      hinge: z.object({ x: mm, y: mm }),
      leafLength: mm.positive(),
      leafThickness: mm.nonnegative(),
      startAngle: z.number().finite(),
      sweepAngle: z.number().finite(),
      zRange: z.object({ min: mm, max: mm }),
      slideDistance: mm.nonnegative().optional()
    });
    connectionPointSchema = z.object({
      id: z.string().min(1),
      system: z.enum(["dc", "ac", "water_fresh", "water_grey", "gas"]),
      offset: vec3Schema,
      label: z.string().optional()
    });
    vanObjectSchema = z.object({
      id: z.string().uuid(),
      projectId: z.string().uuid(),
      name: z.string().min(1).max(120),
      category: z.enum(OBJECT_CATEGORIES),
      kind: z.enum(["fixed", "articulated", "loose"]),
      position: vec3Schema,
      size: size3Schema,
      yaw: z.number().finite(),
      mass: grams,
      cost: z.number().finite().nonnegative(),
      color: z.string().max(32),
      articulation: articulationSchema.nullable(),
      connections: z.array(connectionPointSchema).default([]),
      zIndex: z.number().int(),
      notes: z.string().max(2e3).nullable(),
      catalogSlug: z.string().max(80).nullable().default(null)
    });
    taperPointSchema = z.object({
      z: mm,
      insetLeft: mm,
      insetRight: mm
    });
    vanOverridesSchema = z.object({
      interior: size3Schema.partial().optional(),
      taper: z.array(taperPointSchema).optional(),
      payload: grams.optional(),
      obstacles: z.record(
        z.string(),
        z.object({
          position: vec3Schema.partial().optional(),
          size: size3Schema.partial().optional()
        }).nullable()
      ).optional()
    });
    createProjectSchema = z.object({
      name: z.string().min(1).max(120),
      vanModelId: z.string().nullable().optional(),
      customInterior: size3Schema.nullable().optional()
    });
    updateProjectSchema = z.object({
      name: z.string().min(1).max(120).optional(),
      vanModelId: z.string().nullable().optional(),
      customInterior: size3Schema.nullable().optional(),
      overrides: vanOverridesSchema.optional()
    });
    syncRequestSchema = z.object({
      baseRevision: z.number().int().nonnegative(),
      /**
       * Identifies this client's write so a fire-and-forget `pagehide` flush can be
       * recognised as our own next time the project loads.
       */
      syncId: z.string().uuid(),
      upserts: z.array(vanObjectSchema).max(500),
      deletes: z.array(z.string().uuid()).max(500),
      patch: updateProjectSchema.optional()
    });
    syncOkSchema = z.object({
      ok: z.literal(true),
      revision: z.number().int(),
      updatedAt: z.string()
    });
    syncConflictSchema = z.object({
      ok: z.literal(false),
      reason: z.literal("conflict"),
      /** The server's current state, so the client can offer keep-mine/load-theirs. */
      serverRevision: z.number().int()
    });
    createCatalogItemSchema = z.object({
      name: z.string().min(1).max(120),
      category: z.enum(OBJECT_CATEGORIES),
      kind: z.enum(["fixed", "articulated", "loose"]),
      size: size3Schema,
      mass: grams,
      cost: z.number().finite().nonnegative(),
      color: z.string().max(32),
      basedOnSlug: z.string().max(80).nullable().optional()
    });
    updateSettingsSchema = z.object({
      heightMm: mm.positive().nullable().optional(),
      unitSystem: z.enum(["metric", "imperial"]).optional(),
      disabledRules: z.array(z.string()).optional(),
      gridMm: mm.positive().optional(),
      ghostingEnabled: z.boolean().optional(),
      snapToObjects: z.boolean().optional()
    });
  }
});

// src/lib/config.server.ts
function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string."
    );
  }
  return url;
}
function devUserId() {
  return process.env.DEV_USER_ID ?? "dev-user";
}
var init_config_server = __esm({
  "src/lib/config.server.ts"() {
    "use strict";
  }
});

// src/lib/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  confidenceEnum: () => confidenceEnum,
  objectCategoryEnum: () => objectCategoryEnum,
  objectKindEnum: () => objectKindEnum,
  obstacleKindEnum: () => obstacleKindEnum,
  projectObjects: () => projectObjects,
  projectObjectsRelations: () => projectObjectsRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  unitSystemEnum: () => unitSystemEnum,
  userCatalogItems: () => userCatalogItems,
  userSettings: () => userSettings,
  users: () => users,
  usersRelations: () => usersRelations,
  vanModels: () => vanModels,
  vanModelsRelations: () => vanModelsRelations,
  vanObstacles: () => vanObstacles,
  vanObstaclesRelations: () => vanObstaclesRelations
});
import { relations } from "drizzle-orm";
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
  uuid
} from "drizzle-orm/pg-core";
var confidenceEnum, objectKindEnum, objectCategoryEnum, obstacleKindEnum, unitSystemEnum, users, userSettings, vanModels, vanObstacles, userCatalogItems, projects, projectObjects, usersRelations, projectsRelations, projectObjectsRelations, vanModelsRelations, vanObstaclesRelations;
var init_schema = __esm({
  "src/lib/db/schema.ts"() {
    "use strict";
    confidenceEnum = pgEnum("confidence", [
      "verified",
      "approximate",
      "community"
    ]);
    objectKindEnum = pgEnum("object_kind", ["fixed", "articulated", "loose"]);
    objectCategoryEnum = pgEnum("object_category", [
      "sleeping",
      "kitchen",
      "seating",
      "storage",
      "utility",
      "electrical",
      "water"
    ]);
    obstacleKindEnum = pgEnum("obstacle_kind", [
      "wheel_well",
      "b_pillar",
      "aperture_side",
      "aperture_rear",
      "mount_point",
      "intrusion"
    ]);
    unitSystemEnum = pgEnum("unit_system", ["metric", "imperial"]);
    users = pgTable(
      "users",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        /**
         * The identity-provider subject. Clerk's user id slots straight in here
         * when auth is wired up; until then it holds the dev stand-in.
         */
        externalId: text("external_id").notNull().unique(),
        email: text("email"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
      },
      (table) => [index("users_external_id_idx").on(table.externalId)]
    );
    userSettings = pgTable("user_settings", {
      userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
      /** Null when the user has not told us their height; rules then report only the standard. */
      heightMm: integer("height_mm"),
      unitSystem: unitSystemEnum("unit_system").notNull().default("metric"),
      /** Rule ids the user has switched off. Every rule is individually toggleable. */
      disabledRules: text("disabled_rules").array().notNull().default([]),
      gridMm: integer("grid_mm").notNull().default(10),
      ghostingEnabled: boolean("ghosting_enabled").notNull().default(true),
      snapToObjects: boolean("snap_to_objects").notNull().default(true),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    });
    vanModels = pgTable("van_models", {
      /** Human-readable slug, e.g. `sprinter-144-high`. Stable across reseeds. */
      id: text("id").primaryKey(),
      make: text("make").notNull(),
      model: text("model").notNull(),
      variant: text("variant").notNull().default(""),
      wheelbaseLabel: text("wheelbase_label").notNull(),
      roofLabel: text("roof_label").notNull(),
      interiorW: integer("interior_w").notNull(),
      interiorD: integer("interior_d").notNull(),
      interiorH: integer("interior_h").notNull(),
      /** Wall taper profile; vans are not boxes. */
      taper: jsonb("taper").$type().notNull().default([]),
      payload: integer("payload").notNull(),
      gvwr: integer("gvwr").notNull(),
      frontAxleY: integer("front_axle_y").notNull(),
      rearAxleY: integer("rear_axle_y").notNull(),
      kerbFrontAxle: integer("kerb_front_axle").notNull(),
      kerbRearAxle: integer("kerb_rear_axle").notNull(),
      /**
       * Provenance of these dimensions, surfaced in the UI. Spec section 3 flags
       * that accurate interior figures are not available in any clean public
       * source, so nothing is presented as fact that has not been verified.
       */
      confidence: confidenceEnum("confidence").notNull().default("approximate"),
      sourceNote: text("source_note")
    });
    vanObstacles = pgTable(
      "van_obstacles",
      {
        id: text("id").primaryKey(),
        vanModelId: text("van_model_id").notNull().references(() => vanModels.id, { onDelete: "cascade" }),
        kind: obstacleKindEnum("kind").notNull(),
        name: text("name").notNull(),
        posX: integer("pos_x").notNull(),
        posY: integer("pos_y").notNull(),
        posZ: integer("pos_z").notNull(),
        sizeW: integer("size_w").notNull(),
        sizeD: integer("size_d").notNull(),
        sizeH: integer("size_h").notNull(),
        /** Swing envelope for apertures that open. */
        articulation: jsonb("articulation").$type(),
        confidence: confidenceEnum("confidence").notNull().default("approximate")
      },
      (table) => [index("van_obstacles_model_idx").on(table.vanModelId)]
    );
    userCatalogItems = pgTable(
      "user_catalog_items",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        category: objectCategoryEnum("category").notNull(),
        kind: objectKindEnum("kind").notNull(),
        sizeW: integer("size_w").notNull(),
        sizeD: integer("size_d").notNull(),
        sizeH: integer("size_h").notNull(),
        mass: integer("mass").notNull().default(0),
        cost: integer("cost").notNull().default(0),
        color: text("color").notNull(),
        /** Catalog entry it was derived from, if any. */
        basedOnSlug: text("based_on_slug"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
      },
      (table) => [index("user_catalog_user_idx").on(table.userId)]
    );
    projects = pgTable(
      "projects",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        /** Null for a custom-dimension project. */
        vanModelId: text("van_model_id").references(() => vanModels.id, {
          onDelete: "set null"
        }),
        customInteriorW: integer("custom_interior_w"),
        customInteriorD: integer("custom_interior_d"),
        customInteriorH: integer("custom_interior_h"),
        /**
         * Per-project corrections to the chosen preset. Spec open question,
         * answered: these stay local to the project and never write back to the
         * shared library.
         */
        overrides: jsonb("overrides").$type().notNull().default({}),
        /**
         * Bumped on every successful sync. The client sends the revision it last
         * saw; a mismatch means someone else wrote in between, and the sync is
         * refused rather than silently overwriting their work.
         */
        revision: integer("revision").notNull().default(0),
        /**
         * Id of the client sync that last wrote here.
         *
         * A `pagehide` flush goes out via sendBeacon, which cannot report back — so
         * the client has no way to learn that its parting write landed, and would
         * otherwise see its own successful save as someone else's edit the next time
         * the project is opened. Comparing this against the id the client knows it
         * sent tells the two apart.
         */
        lastSyncId: text("last_sync_id"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp("deleted_at", { withTimezone: true })
      },
      (table) => [index("projects_user_idx").on(table.userId)]
    );
    projectObjects = pgTable(
      "project_objects",
      {
        /**
         * Generated on the client. That is what makes the sync upsert idempotent:
         * a retried request after a flaky connection writes the same rows rather
         * than duplicating them, and no id has to round-trip before the user can
         * carry on editing.
         */
        id: uuid("id").primaryKey(),
        projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        category: objectCategoryEnum("category").notNull(),
        kind: objectKindEnum("kind").notNull(),
        posX: integer("pos_x").notNull(),
        posY: integer("pos_y").notNull(),
        posZ: integer("pos_z").notNull(),
        sizeW: integer("size_w").notNull(),
        sizeD: integer("size_d").notNull(),
        sizeH: integer("size_h").notNull(),
        /** Degrees; real rather than integer so 22.5-degree placements survive. */
        yaw: real("yaw").notNull().default(0),
        mass: integer("mass").notNull().default(0),
        cost: integer("cost").notNull().default(0),
        color: text("color").notNull(),
        /** Polymorphic by design — see the file header. */
        articulation: jsonb("articulation").$type(),
        connections: jsonb("connections").$type().notNull().default([]),
        zIndex: integer("z_index").notNull().default(0),
        notes: text("notes"),
        /** Catalog entry this was created from; null for a from-scratch object. */
        catalogSlug: text("catalog_slug"),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (table) => [index("project_objects_project_idx").on(table.projectId)]
    );
    usersRelations = relations(users, ({ many, one }) => ({
      projects: many(projects),
      catalogItems: many(userCatalogItems),
      settings: one(userSettings, {
        fields: [users.id],
        references: [userSettings.userId]
      })
    }));
    projectsRelations = relations(projects, ({ many, one }) => ({
      objects: many(projectObjects),
      vanModel: one(vanModels, {
        fields: [projects.vanModelId],
        references: [vanModels.id]
      }),
      owner: one(users, { fields: [projects.userId], references: [users.id] })
    }));
    projectObjectsRelations = relations(projectObjects, ({ one }) => ({
      project: one(projects, {
        fields: [projectObjects.projectId],
        references: [projects.id]
      })
    }));
    vanModelsRelations = relations(vanModels, ({ many }) => ({
      obstacles: many(vanObstacles)
    }));
    vanObstaclesRelations = relations(vanObstacles, ({ one }) => ({
      model: one(vanModels, {
        fields: [vanObstacles.vanModelId],
        references: [vanModels.id]
      })
    }));
  }
});

// src/lib/db/client.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
function retryingFetch(input, init) {
  const attempt = async (remaining, delays) => {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (remaining <= 1) throw error;
      const [delay = 1e3, ...rest] = delays;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return attempt(remaining - 1, rest);
    }
  };
  return attempt(CONNECT_ATTEMPTS, RETRY_DELAYS_MS);
}
function create() {
  neonConfig.fetchFunction = retryingFetch;
  const sql2 = neon(databaseUrl());
  return drizzle(sql2, { schema: schema_exports, casing: "snake_case" });
}
function db() {
  cached ??= create();
  return cached;
}
var cached, CONNECT_ATTEMPTS, RETRY_DELAYS_MS;
var init_client = __esm({
  "src/lib/db/client.ts"() {
    "use strict";
    init_config_server();
    init_schema();
    cached = null;
    CONNECT_ATTEMPTS = 3;
    RETRY_DELAYS_MS = [400, 1200];
  }
});

// src/lib/config.ts
var SYNC_INTERVAL_MS, DEFAULT_GRID_MM;
var init_config = __esm({
  "src/lib/config.ts"() {
    "use strict";
    SYNC_INTERVAL_MS = 5 * 60 * 1e3;
    DEFAULT_GRID_MM = 10;
  }
});

// src/lib/db/mappers.ts
function rowToProject(row) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    vanModelId: row.vanModelId,
    customInterior: row.customInteriorW !== null && row.customInteriorD !== null && row.customInteriorH !== null ? { w: row.customInteriorW, d: row.customInteriorD, h: row.customInteriorH } : null,
    overrides: row.overrides ?? {},
    revision: row.revision,
    lastSyncId: row.lastSyncId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
function rowToObject(row) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    category: row.category,
    kind: row.kind,
    position: { x: row.posX, y: row.posY, z: row.posZ },
    size: { w: row.sizeW, d: row.sizeD, h: row.sizeH },
    yaw: row.yaw,
    mass: row.mass,
    cost: row.cost,
    color: row.color,
    articulation: row.articulation ?? null,
    connections: row.connections ?? [],
    zIndex: row.zIndex,
    notes: row.notes,
    catalogSlug: row.catalogSlug
  };
}
function objectToRow(object) {
  return {
    id: object.id,
    projectId: object.projectId,
    name: object.name,
    category: object.category,
    kind: object.kind,
    posX: Math.round(object.position.x),
    posY: Math.round(object.position.y),
    posZ: Math.round(object.position.z),
    sizeW: Math.round(object.size.w),
    sizeD: Math.round(object.size.d),
    sizeH: Math.round(object.size.h),
    yaw: object.yaw,
    mass: Math.round(object.mass),
    cost: Math.round(object.cost),
    color: object.color,
    articulation: object.articulation,
    connections: object.connections,
    zIndex: object.zIndex,
    notes: object.notes,
    catalogSlug: object.catalogSlug,
    updatedAt: /* @__PURE__ */ new Date()
  };
}
function rowToVanObstacle(row) {
  return {
    id: row.id,
    vanModelId: row.vanModelId,
    kind: row.kind,
    name: row.name,
    position: { x: row.posX, y: row.posY, z: row.posZ },
    size: { w: row.sizeW, d: row.sizeD, h: row.sizeH },
    articulation: row.articulation ?? null,
    confidence: row.confidence
  };
}
function rowToVanModel(row, obstacles) {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    variant: row.variant,
    wheelbaseLabel: row.wheelbaseLabel,
    roofLabel: row.roofLabel,
    interior: { w: row.interiorW, d: row.interiorD, h: row.interiorH },
    taper: row.taper ?? [],
    payload: row.payload,
    gvwr: row.gvwr,
    frontAxleY: row.frontAxleY,
    rearAxleY: row.rearAxleY,
    kerbFrontAxle: row.kerbFrontAxle,
    kerbRearAxle: row.kerbRearAxle,
    confidence: row.confidence,
    sourceNote: row.sourceNote,
    obstacles
  };
}
function rowToUserCatalogItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    kind: row.kind,
    size: { w: row.sizeW, d: row.sizeD, h: row.sizeH },
    mass: row.mass,
    cost: row.cost,
    color: row.color,
    basedOnSlug: row.basedOnSlug,
    createdAt: row.createdAt.toISOString()
  };
}
var init_mappers = __esm({
  "src/lib/db/mappers.ts"() {
    "use strict";
  }
});

// src/lib/data.ts
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
async function getUserSettings(userId) {
  const rows = await db().select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) {
    return {
      userId,
      heightMm: null,
      unitSystem: "metric",
      disabledRules: [],
      gridMm: DEFAULT_GRID_MM,
      ghostingEnabled: true,
      snapToObjects: true
    };
  }
  return {
    userId: row.userId,
    heightMm: row.heightMm,
    unitSystem: row.unitSystem,
    disabledRules: row.disabledRules,
    gridMm: row.gridMm,
    ghostingEnabled: row.ghostingEnabled,
    snapToObjects: row.snapToObjects
  };
}
async function listProjects(userId) {
  const rows = await db().select({
    id: projects.id,
    name: projects.name,
    revision: projects.revision,
    updatedAt: projects.updatedAt,
    vanModelId: projects.vanModelId,
    make: vanModels.make,
    model: vanModels.model,
    wheelbaseLabel: vanModels.wheelbaseLabel,
    roofLabel: vanModels.roofLabel,
    objectCount: count(projectObjects.id)
  }).from(projects).leftJoin(vanModels, eq(projects.vanModelId, vanModels.id)).leftJoin(projectObjects, eq(projectObjects.projectId, projects.id)).where(and(eq(projects.userId, userId), isNull(projects.deletedAt))).groupBy(
    projects.id,
    vanModels.make,
    vanModels.model,
    vanModels.wheelbaseLabel,
    vanModels.roofLabel
  ).orderBy(desc(projects.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    vanLabel: row.make ? `${row.make} ${row.model} ${row.wheelbaseLabel} ${row.roofLabel}`.trim() : "Custom dimensions",
    objectCount: Number(row.objectCount),
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString()
  }));
}
async function getProject(userId, projectId) {
  const rows = await db().select().from(projects).where(
    and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt))
  ).limit(1);
  const row = rows[0];
  return row ? rowToProject(row) : null;
}
async function getProjectObjects(projectId) {
  const rows = await db().select().from(projectObjects).where(eq(projectObjects.projectId, projectId)).orderBy(asc(projectObjects.zIndex));
  return rows.map(rowToObject);
}
async function listVanModels() {
  const modelRows = await db().select().from(vanModels).orderBy(asc(vanModels.make), asc(vanModels.model), asc(vanModels.wheelbaseLabel));
  const obstacleRows = await db().select().from(vanObstacles);
  const byModel = /* @__PURE__ */ new Map();
  for (const row of obstacleRows) {
    const list = byModel.get(row.vanModelId) ?? [];
    list.push(rowToVanObstacle(row));
    byModel.set(row.vanModelId, list);
  }
  return modelRows.map((row) => rowToVanModel(row, byModel.get(row.id) ?? []));
}
async function listUserCatalogItems(userId) {
  const rows = await db().select().from(userCatalogItems).where(eq(userCatalogItems.userId, userId)).orderBy(desc(userCatalogItems.createdAt));
  return rows.map(rowToUserCatalogItem);
}
var init_data = __esm({
  "src/lib/data.ts"() {
    "use strict";
    init_client();
    init_schema();
    init_config();
    init_mappers();
  }
});

// src/lib/actions/projects.ts
import { and as and2, eq as eq2, isNull as isNull2 } from "drizzle-orm";
async function createProject(userId, input) {
  const rows = await db().insert(projects).values({
    userId,
    name: input.name,
    vanModelId: input.vanModelId ?? null,
    customInteriorW: input.customInterior?.w ?? null,
    customInteriorD: input.customInterior?.d ?? null,
    customInteriorH: input.customInterior?.h ?? null
  }).returning();
  return rowToProject(rows[0]);
}
async function updateProject(userId, projectId, patch) {
  const values = { updatedAt: /* @__PURE__ */ new Date() };
  if (patch.name !== void 0) values.name = patch.name;
  if (patch.vanModelId !== void 0) values.vanModelId = patch.vanModelId;
  if (patch.overrides !== void 0) values.overrides = patch.overrides;
  if (patch.customInterior !== void 0) {
    values.customInteriorW = patch.customInterior?.w ?? null;
    values.customInteriorD = patch.customInterior?.d ?? null;
    values.customInteriorH = patch.customInterior?.h ?? null;
  }
  const rows = await db().update(projects).set(values).where(
    and2(eq2(projects.id, projectId), eq2(projects.userId, userId), isNull2(projects.deletedAt))
  ).returning();
  const row = rows[0];
  return row ? rowToProject(row) : null;
}
async function deleteProject(userId, projectId) {
  const rows = await db().update(projects).set({ deletedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(
    and2(eq2(projects.id, projectId), eq2(projects.userId, userId), isNull2(projects.deletedAt))
  ).returning({ id: projects.id });
  return rows.length > 0;
}
async function duplicateProject(userId, projectId, name) {
  const sourceRows = await db().select().from(projects).where(
    and2(eq2(projects.id, projectId), eq2(projects.userId, userId), isNull2(projects.deletedAt))
  ).limit(1);
  const source = sourceRows[0];
  if (!source) return null;
  const createdRows = await db().insert(projects).values({
    userId,
    name,
    vanModelId: source.vanModelId,
    customInteriorW: source.customInteriorW,
    customInteriorD: source.customInteriorD,
    customInteriorH: source.customInteriorH,
    overrides: source.overrides
  }).returning();
  const created = createdRows[0];
  const sourceObjects = await db().select().from(projectObjects).where(eq2(projectObjects.projectId, projectId));
  if (sourceObjects.length > 0) {
    await db().insert(projectObjects).values(
      sourceObjects.map((object) => ({
        ...object,
        id: crypto.randomUUID(),
        projectId: created.id,
        updatedAt: /* @__PURE__ */ new Date()
      }))
    );
  }
  return rowToProject(created);
}
var init_projects = __esm({
  "src/lib/actions/projects.ts"() {
    "use strict";
    init_client();
    init_schema();
    init_mappers();
  }
});

// src/lib/actions/sync.ts
import { and as and3, eq as eq3, inArray, isNull as isNull3, sql } from "drizzle-orm";
async function applySync(userId, projectId, request) {
  const bumped = await db().update(projects).set({
    revision: sql`${projects.revision} + 1`,
    lastSyncId: request.syncId,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(
    and3(
      eq3(projects.id, projectId),
      eq3(projects.userId, userId),
      eq3(projects.revision, request.baseRevision),
      isNull3(projects.deletedAt)
    )
  ).returning({ revision: projects.revision, updatedAt: projects.updatedAt });
  const result = bumped[0];
  if (!result) {
    const current = await db().select({ revision: projects.revision }).from(projects).where(and3(eq3(projects.id, projectId), eq3(projects.userId, userId))).limit(1);
    return {
      ok: false,
      reason: "conflict",
      serverRevision: current[0]?.revision ?? -1
    };
  }
  await writeDelta(projectId, request.upserts, request.deletes);
  if (request.patch && Object.keys(request.patch).length > 0) {
    await applyProjectPatch(userId, projectId, request.patch);
  }
  return {
    ok: true,
    revision: result.revision,
    updatedAt: result.updatedAt.toISOString()
  };
}
async function writeDelta(projectId, upserts, deletes) {
  const statements = [];
  if (upserts.length > 0) {
    const rows = upserts.filter((object) => object.projectId === projectId).map((object) => objectToRow(object));
    if (rows.length > 0) {
      statements.push(
        db().insert(projectObjects).values(rows).onConflictDoUpdate({
          target: projectObjects.id,
          set: {
            name: sql`excluded.name`,
            category: sql`excluded.category`,
            kind: sql`excluded.kind`,
            posX: sql`excluded.pos_x`,
            posY: sql`excluded.pos_y`,
            posZ: sql`excluded.pos_z`,
            sizeW: sql`excluded.size_w`,
            sizeD: sql`excluded.size_d`,
            sizeH: sql`excluded.size_h`,
            yaw: sql`excluded.yaw`,
            mass: sql`excluded.mass`,
            cost: sql`excluded.cost`,
            color: sql`excluded.color`,
            articulation: sql`excluded.articulation`,
            connections: sql`excluded.connections`,
            zIndex: sql`excluded.z_index`,
            notes: sql`excluded.notes`,
            catalogSlug: sql`excluded.catalog_slug`,
            updatedAt: sql`excluded.updated_at`
          },
          // Scoped to the project so a stray id cannot overwrite a row
          // belonging to someone else's build.
          setWhere: eq3(projectObjects.projectId, projectId)
        })
      );
    }
  }
  if (deletes.length > 0) {
    statements.push(
      db().delete(projectObjects).where(
        and3(
          eq3(projectObjects.projectId, projectId),
          inArray(projectObjects.id, deletes)
        )
      )
    );
  }
  if (statements.length === 0) return;
  await db().batch(statements);
}
async function applyProjectPatch(userId, projectId, patch) {
  const values = {};
  if (patch.name !== void 0) values.name = patch.name;
  if (patch.vanModelId !== void 0) values.vanModelId = patch.vanModelId;
  if (patch.overrides !== void 0) values.overrides = patch.overrides;
  if (patch.customInterior !== void 0) {
    values.customInteriorW = patch.customInterior?.w ?? null;
    values.customInteriorD = patch.customInterior?.d ?? null;
    values.customInteriorH = patch.customInterior?.h ?? null;
  }
  if (Object.keys(values).length === 0) return;
  await db().update(projects).set(values).where(and3(eq3(projects.id, projectId), eq3(projects.userId, userId)));
}
var init_sync = __esm({
  "src/lib/actions/sync.ts"() {
    "use strict";
    init_client();
    init_schema();
    init_mappers();
  }
});

// src/lib/actions/settings.ts
import { eq as eq4 } from "drizzle-orm";
async function ensureUser(externalId, email) {
  const existing = await db().select({ id: users.id }).from(users).where(eq4(users.externalId, externalId)).limit(1);
  const found = existing[0];
  if (found) return found.id;
  const created = await db().insert(users).values({ externalId, email: email ?? null }).onConflictDoUpdate({
    target: users.externalId,
    set: { externalId }
  }).returning({ id: users.id });
  return created[0].id;
}
async function updateUserSettings(userId, patch) {
  const insertValues = {
    userId,
    heightMm: patch.heightMm ?? null,
    unitSystem: patch.unitSystem ?? "metric",
    disabledRules: patch.disabledRules ?? [],
    gridMm: patch.gridMm ?? DEFAULT_GRID_MM,
    ghostingEnabled: patch.ghostingEnabled ?? true,
    snapToObjects: patch.snapToObjects ?? true,
    updatedAt: /* @__PURE__ */ new Date()
  };
  const updateValues = { updatedAt: /* @__PURE__ */ new Date() };
  if (patch.heightMm !== void 0) updateValues.heightMm = patch.heightMm;
  if (patch.unitSystem !== void 0) updateValues.unitSystem = patch.unitSystem;
  if (patch.disabledRules !== void 0) updateValues.disabledRules = patch.disabledRules;
  if (patch.gridMm !== void 0) updateValues.gridMm = patch.gridMm;
  if (patch.ghostingEnabled !== void 0) updateValues.ghostingEnabled = patch.ghostingEnabled;
  if (patch.snapToObjects !== void 0) updateValues.snapToObjects = patch.snapToObjects;
  const rows = await db().insert(userSettings).values(insertValues).onConflictDoUpdate({ target: userSettings.userId, set: updateValues }).returning();
  const row = rows[0];
  return {
    userId: row.userId,
    heightMm: row.heightMm,
    unitSystem: row.unitSystem,
    disabledRules: row.disabledRules,
    gridMm: row.gridMm,
    ghostingEnabled: row.ghostingEnabled,
    snapToObjects: row.snapToObjects
  };
}
var init_settings = __esm({
  "src/lib/actions/settings.ts"() {
    "use strict";
    init_client();
    init_schema();
    init_config();
  }
});

// src/lib/actions/catalog.ts
import { and as and4, eq as eq5 } from "drizzle-orm";
async function createCatalogItem(userId, input) {
  const rows = await db().insert(userCatalogItems).values({
    userId,
    name: input.name,
    category: input.category,
    kind: input.kind,
    sizeW: Math.round(input.size.w),
    sizeD: Math.round(input.size.d),
    sizeH: Math.round(input.size.h),
    mass: Math.round(input.mass),
    cost: Math.round(input.cost),
    color: input.color,
    basedOnSlug: input.basedOnSlug ?? null
  }).returning();
  return rowToUserCatalogItem(rows[0]);
}
async function deleteCatalogItem(userId, id) {
  const rows = await db().delete(userCatalogItems).where(and4(eq5(userCatalogItems.id, id), eq5(userCatalogItems.userId, userId))).returning({ id: userCatalogItems.id });
  return rows.length > 0;
}
var init_catalog = __esm({
  "src/lib/actions/catalog.ts"() {
    "use strict";
    init_client();
    init_schema();
    init_mappers();
  }
});

// server/middleware/auth.ts
import { createMiddleware } from "hono/factory";
var userIdCache, DEV_IDENTITY_HEADER, auth;
var init_auth = __esm({
  "server/middleware/auth.ts"() {
    "use strict";
    init_config_server();
    init_settings();
    userIdCache = /* @__PURE__ */ new Map();
    DEV_IDENTITY_HEADER = "x-dev-identity";
    auth = createMiddleware(async (c, next) => {
      const requested = c.req.header(DEV_IDENTITY_HEADER);
      const externalId = requested ? `dev-scoped:${requested}` : devUserId();
      let userId = userIdCache.get(externalId);
      if (!userId) {
        userId = await ensureUser(externalId);
        userIdCache.set(externalId, userId);
      }
      c.set("userId", userId);
      c.set("externalId", externalId);
      await next();
    });
  }
});

// server/app.ts
var app_exports = {};
__export(app_exports, {
  default: () => app_default,
  routes: () => routes
});
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z as z2 } from "zod";
var app, uuidParam, routes, app_default;
var init_app = __esm({
  "server/app.ts"() {
    "use strict";
    init_api();
    init_data();
    init_projects();
    init_sync();
    init_settings();
    init_catalog();
    init_auth();
    app = new Hono().basePath("/api");
    app.use("*", logger());
    app.use("*", cors());
    app.onError((error, c) => {
      if (error instanceof HTTPException) return error.getResponse();
      console.error("Unhandled API error", error);
      return c.json({ error: "Internal error" }, 500);
    });
    uuidParam = z2.object({ id: z2.string().uuid() });
    routes = app.get("/health", (c) => c.json({ ok: true })).get("/van-models", async (c) => {
      const models = await listVanModels();
      return c.json({ models });
    }).use("/projects/*", auth).use("/projects", auth).use("/settings", auth).use("/catalog", auth).use("/catalog/*", auth).get("/catalog", async (c) => {
      const items = await listUserCatalogItems(c.get("userId"));
      return c.json({ items });
    }).post("/catalog", zValidator("json", createCatalogItemSchema), async (c) => {
      const item = await createCatalogItem(c.get("userId"), c.req.valid("json"));
      return c.json({ item }, 201);
    }).delete("/catalog/:id", zValidator("param", uuidParam), async (c) => {
      const deleted = await deleteCatalogItem(c.get("userId"), c.req.valid("param").id);
      if (!deleted) throw new HTTPException(404, { message: "Piece not found" });
      return c.json({ ok: true });
    }).get("/settings", async (c) => {
      const settings = await getUserSettings(c.get("userId"));
      return c.json({ settings });
    }).patch("/settings", zValidator("json", updateSettingsSchema), async (c) => {
      const settings = await updateUserSettings(c.get("userId"), c.req.valid("json"));
      return c.json({ settings });
    }).get("/projects", async (c) => {
      const projects2 = await listProjects(c.get("userId"));
      return c.json({ projects: projects2 });
    }).post("/projects", zValidator("json", createProjectSchema), async (c) => {
      const project = await createProject(c.get("userId"), c.req.valid("json"));
      return c.json({ project }, 201);
    }).get("/projects/:id", zValidator("param", uuidParam), async (c) => {
      const userId = c.get("userId");
      const { id } = c.req.valid("param");
      const project = await getProject(userId, id);
      if (!project) throw new HTTPException(404, { message: "Project not found" });
      const objects = await getProjectObjects(id);
      return c.json({ project, objects });
    }).patch(
      "/projects/:id",
      zValidator("param", uuidParam),
      zValidator("json", updateProjectSchema),
      async (c) => {
        const { id } = c.req.valid("param");
        const project = await updateProject(c.get("userId"), id, c.req.valid("json"));
        if (!project) throw new HTTPException(404, { message: "Project not found" });
        return c.json({ project });
      }
    ).delete("/projects/:id", zValidator("param", uuidParam), async (c) => {
      const { id } = c.req.valid("param");
      const deleted = await deleteProject(c.get("userId"), id);
      if (!deleted) throw new HTTPException(404, { message: "Project not found" });
      return c.json({ ok: true });
    }).post(
      "/projects/:id/duplicate",
      zValidator("param", uuidParam),
      zValidator("json", z2.object({ name: z2.string().min(1).max(120) })),
      async (c) => {
        const { id } = c.req.valid("param");
        const project = await duplicateProject(c.get("userId"), id, c.req.valid("json").name);
        if (!project) throw new HTTPException(404, { message: "Project not found" });
        return c.json({ project }, 201);
      }
    ).post(
      "/projects/:id/sync",
      zValidator("param", uuidParam),
      zValidator("json", syncRequestSchema),
      async (c) => {
        const { id } = c.req.valid("param");
        const result = await applySync(c.get("userId"), id, c.req.valid("json"));
        return c.json(result, result.ok ? 200 : 409);
      }
    );
    app_default = app;
  }
});

// server/vercel.ts
var cached2 = null;
async function getApp() {
  cached2 ??= (await Promise.resolve().then(() => (init_app(), app_exports))).default;
  return cached2;
}
async function handler(req, res) {
  try {
    const app2 = await getApp();
    const response = await app2.fetch(await toRequest(req));
    await writeResponse(res, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Function invocation failed", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Internal error", reason: message }));
  }
}
async function toRequest(req) {
  const proto = header(req, "x-forwarded-proto") ?? "https";
  const host = header(req, "x-forwarded-host") ?? header(req, "host") ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === void 0) continue;
    if (Array.isArray(value)) for (const entry of value) headers.append(key, entry);
    else headers.set(key, value);
  }
  const method = req.method ?? "GET";
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await readBody(req);
  }
  return new Request(url, init);
}
async function readBody(req) {
  const parsed = req.body;
  if (parsed !== void 0 && parsed !== null) {
    if (typeof parsed === "string") return parsed;
    if (Buffer.isBuffer(parsed)) return new Uint8Array(parsed);
    return JSON.stringify(parsed);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return void 0;
  return new Uint8Array(Buffer.concat(chunks));
}
async function writeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") res.appendHeader(key, value);
    else res.setHeader(key, value);
  });
  if (!response.body) {
    res.end();
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
function header(req, name) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
export {
  handler as default
};
