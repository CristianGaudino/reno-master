# Van Build Planner

A 2D van conversion planner. You pick a van, lay out furniture and fixtures, and
the tool tells you when your plan won't work — clearances, headroom, door swings,
weight.

Accuracy is the point. Everything below that could mislead you is called out
rather than glossed over.

---

## Read this before trusting a number

**The bundled van dimensions are not verified.** Accurate interior dimensions are
not available in any clean public source: manufacturers publish load-area figures
that don't match what a builder needs — maximum width rather than width between
the wheel wells, height at the centreline rather than at the wall, load length
measured to the doors rather than to the bulkhead you're building against.

So every seeded figure is assembled from published specs and conversion drawings
and tagged **approximate**. Nothing ships tagged `verified`. The confidence badge
is shown in the UI next to the dimension it qualifies, and any dimension can be
corrected per project without affecting the shared library or anyone else's
build.

**Measure your own van before you cut anything.**

---

## Stack

| Piece | Choice |
|---|---|
| Frontend | Vite 8 + React 19 SPA, TypeScript strict, React Router 8 |
| Editor state | Zustand, with command-pattern undo/redo |
| Server state | TanStack Query |
| API | Hono, bundled to a single Vercel serverless function |
| Database | Neon Postgres via Drizzle ORM (HTTP driver) |
| Styling | Tailwind v4 |
| Tests | Vitest over the geometry and rules layers |

Auth is deliberately stubbed — see [Clerk](#swapping-in-clerk).

## Running it

```bash
npm install
cp .env.example .env.local     # add your Neon connection string
npm run db:push                # create the schema
npm run db:seed                # load the van presets
npm run dev                    # Vite on :5173, API on :8787
```

`npm run dev` runs the Vite dev server and the API together; Vite proxies `/api`
to it, so the browser stays on one origin and development uses the same code path
as production.

| Command | |
|---|---|
| `npm test` | Vitest — geometry, units, rules, systems, templates |
| `npm run typecheck` | Both TS programs (client and server) |
| `npm run lint` | ESLint, including the server-only import guard |
| `npm run build` | Typecheck, build the SPA, bundle the API function |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:seed` | Re-seed the van presets (idempotent) |

## How it fits together

```
src/lib/
  definitions/   shared types and the Zod wire contracts
  constants.ts   domain invariants (mm per inch, the 6'0" standard, rule ids)
  config.ts      tunables (sync interval, default grid) — browser-safe
  config.server.ts  environment access — server only
  data.ts        all read queries          } server only, behind the API
  actions/       all write queries         }
  db/            Drizzle schema and client } 
  api/           typed client + TanStack Query bindings
  geometry/      pure, tested: OBB, SAT, projection, swing arcs, corridor scan
  rules/         one module per check, registered in registry.ts
  catalog.ts  vans.ts  templates.ts  systems.ts  units.ts
src/components/  ui primitives, editor, projects
src/store/       editorStore, history, localStore (IndexedDB), syncEngine
server/          Hono app — the only importer of data.ts and actions/
```

**Server-only code is enforced, not just documented.** An ESLint rule fails the
build if anything under `components/`, `routes/` or `store/` imports `lib/data`,
`lib/actions/*`, `lib/db/*` or `lib/config.server` — in a Vite SPA that would ship
the Neon driver and your connection string to the browser.

### One object model, three views

Every object carries full 3D bounds. The three views are projections of the same
record, all going through `geometry/project.ts`, so a drag in the side elevation
writes what the floor plan reads. Adding a 3D view later is a rendering job rather
than a rewrite.

### Persistence is local-first

IndexedDB is the write path. Every edit lands there immediately — that is what
delivers "no data loss on refresh", with no network involved and nothing to
debounce. Neon is a durable checkpoint on top, committed:

- every 5 minutes while anything is pending
- on ⌘/Ctrl-S or **Save now**
- when the delta grows past 40 objects
- on leaving the editor, and on tab-hide via `sendBeacon`

**The trade-off:** between commits, up to five minutes of work exists only in that
browser's storage. Refresh, navigation, tab close and a browser crash are all
covered. Losing the machine, clearing site data, or picking the project up on
another device are not. `SYNC_INTERVAL_MS` in `lib/config.ts` is the one constant
to change if you want it tighter.

Concurrent edits are caught rather than merged: the client sends the revision it
built on, and a mismatch returns 409 with the server's state so the UI can offer
*keep mine* / *load theirs*. Nothing is silently overwritten.

## Known limitations

These are real and deliberate, not oversights.

- **Van dimensions are unverified.** See the top of this file.
- **Axle capacities are apportioned, not published.** Per-axle ratings aren't in
  the seed data, so the front/rear figures split the payload the way the kerb
  weight already sits. Treat them as a prompt to weigh the van, not a measurement.
- **The aisle check measures a straight corridor.** It doesn't model an L-shaped
  route around a corner, so a dog-leg walkway can measure narrower than it really
  walks. A proper walkable-region analysis is a bigger job.
- **System runs are inferred, not drawn.** Everything electrical is assumed to
  hang off the battery and everything plumbed off the fresh tank via the pump.
  That's right for almost every van build, and wrong for an unusual one.
- **Run lengths are right-angled estimates.** Good enough to catch a battery at
  the wrong end of the van; not a substitute for sizing cable against actual
  current draw.
- **Ergonomic thresholds use conventional design-guide body ratios**, not
  measurements of you. They catch layouts that are obviously wrong, which is what
  warnings are for.

## Warnings report two bodies

Ergonomic checks always report against a 6'0" standard as well as your own
height, whatever you enter in settings — the designer is not the only person who
will ever use the van. Where the two differ, both are shown.

Every check can be switched off individually in settings.

## Swapping in Clerk

Auth is a stub, arranged so that replacing it is one file.

1. `server/middleware/auth.ts` — verify the Clerk session token and use its `sub`
   as `externalId`. That's the whole server change.
2. Add Clerk's standard React provider on the client.
3. Delete `DEV_USER_ID` from your environment.

`users.external_id` already exists to hold the Clerk id, `ensureUser` already
handles first sight of an account, and every query in `data.ts` and `actions/`
already filters on the internal user id the middleware resolves.

## Not built

Deferred by the spec: 3D view, build sequencing, cut lists, full electrical and
plumbing schematics, collaboration, export, payments.

The object model doesn't preclude any of them — 3D in particular is a rendering
concern, since the data is already three-dimensional.
