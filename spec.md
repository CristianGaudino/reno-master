# Van Build Planner — Spec

## What it is

A 2D van conversion planner. You pick a van, lay out furniture and fixtures, and
the tool tells you when your plan won't work — clearances, headroom, door swings,
weight. Accuracy is the point: existing tools are either buggy or overpriced for
what they do.

3D and the build-sequencing side are deliberately deferred. The data model must
not preclude them.

---

## 1. Core concept

**One object model, multiple 2D views.**

Every object in a van has full 3D bounds — width, depth, height, plus a position
in all three axes. The app never renders 3D in v1, but every view is a 2D
projection of the same underlying data. Move something in the floor plan and it
moves in the side elevation. Build it this way from the start and adding 3D later
is a rendering job, not a rewrite.

### Views

- **Top-down (default)** — the primary working view, the blueprint
- **Side elevation** — headroom, bed height, cabinet heights
- **Rear elevation** — width at different heights

All views are editable. The user switches freely while placing objects.

### Height slider (section cut)

A slider sets a cut height. The top-down view shows what exists at that height —
so at 12" you see the bed platform and cabinet bases; at 55" you see overhead
lockers and nothing else.

Objects above the current cut render **ghosted** by default (dashed or reduced
opacity) so nothing disappears silently. Ghosting can be toggled off.

### Layers

Toggleable overlays on the same plan:

- Structure (furniture, fixtures)
- Electrical
- Plumbing
- Storage / capacity

Layers keep the top-down view legible as systems get added. Warnings belong to a
layer — a cable-run warning surfaces in the electrical view, not while the user
is placing a bed.

---

## 2. Object types

Three distinct types, because they behave differently under the rules engine.

### Fixed

Bolted down, never moves. Bed platform, galley, water tank.
Occupies its bounding box. Full clearance checks apply.

### Articulated

Fixed in place but sweeps through space when operated. Cabinet doors, fridge
door, swivel seat, fold-out table, and the van's own sliding door and rear doors.

Needs a **swing arc** in addition to its closed footprint: hinge point, sweep
angle, and swing direction. Conflict checks run against the **swept volume**, not
the closed footprint.

This is where real layouts fail — the fridge door that can't open because the bed
is three inches too close. This is the highest-value check in the app.

### Loose

Genuinely movable. Beanbag, portable toilet, crates, gear.

Does **not** trigger clearance or circulation warnings. Still counts toward
weight, axle load, and storage volume.

---

## 3. Van models

### Preset library

Make / model / wheelbase / roof-height combinations, each with interior
dimensions. Common ones to seed:

- Mercedes Sprinter (144" and 170" WB, standard and high roof)
- Ford Transit (130"/148" WB, low/medium/high roof)
- Ram ProMaster (118"/136"/159" WB, low/high roof)
- VW Crafter / MAN TGE
- Peugeot Boxer / Citroën Relay / Fiat Ducato
- Renault Master / Vauxhall Movano
- Ford Transit Custom, VW Transporter (smaller builds)

Custom dimensions are always available as an escape hatch.

### Fixed obstacles (per model)

The constraints that break real layouts and can't be moved:

- Wheel wells (position, width, depth, height)
- Sliding door aperture (position, width, and swing/slide envelope)
- Rear door aperture and swing arc
- B-pillar and other structural intrusions
- Existing floor mounting points where known
- Wall taper — vans are not boxes; interior width at floor differs from width at
  shoulder height. This matters for the rear elevation view and for any cabinet
  above waist height.

**Data risk, flagged up front:** accurate interior dimensions are not available
in any clean public database. Manufacturer specs publish load-area figures that
don't match what a builder needs (width *between* wheel wells, height at
centerline vs. at the wall). This data has to be assembled from forums,
conversion-company drawings, and physical measurement.

Mitigation for v1: ship a small number of models with dimensions marked by
confidence level (verified / approximate / community-submitted), display that
confidence in the UI, and let users correct dimensions on their own project.
Do not silently present unverified numbers as fact.

---

## 4. Rules engine

Each rule is a **separate named check**, not one monolithic validation pass. New
rules can be added without touching existing ones. Every rule is individually
toggleable in user settings.

### Hard conflicts (objectively wrong)

- Two objects occupying the same space
- Object exceeds van interior bounds
- Object intersects a fixed obstacle (wheel well, pillar)
- Articulated object's swing arc is blocked
- Object blocks a door aperture

### Ergonomic warnings (depend on the person)

- Standing headroom at galley / work surfaces
- Sitting headroom over bed and seating
- Aisle width for circulation
- Bed length
- Reach height to overhead storage
- Clearance to open a door and get past it

### Height calibration

The user may optionally enter their height, and warnings calibrate to it.

**Warnings always also report against a 6'0" standard**, regardless of the user's
height — the designer is not the only person who will ever use the van.

Present both where they differ:

> Sitting headroom over bed: 34"
> Tight for someone 6'0" · fits you at 5'8"

### Weight and axle load

Every object has a mass. Derived from that:

- Total build weight against the van's payload limit
- Front / rear axle load distribution based on object positions

Overloading is a genuine safety and legal problem and people do it constantly —
water, batteries, and plywood are the usual culprits. This is cheap to compute
given the data already in the model.

---

## 5. Templates

Pre-built layouts for a given van model — e.g. weekender, full-time with shower,
gear hauler.

**Templates fork.** Loading a template copies it into the user's project; there
is no ongoing link to the source. Simpler, and the user owns what they change.

---

## 6. Catalog and custom objects

- Furniture/fixture catalog with sensible default dimensions, mass, and cost,
  grouped by category (sleeping, kitchen, seating, storage, utility, electrical,
  water)
- Users can add custom objects with specified dimensions
- Any object can be resized, renamed, rotated, and repositioned

---

## 7. Systems (light, v1)

Not full schematics. Enough to catch the obvious mistakes:

- Mark connection points on relevant objects (battery, solar controller, fridge,
  water tank, pump, taps)
- Compute run lengths between connected objects
- Warn on excessive DC cable runs and awkward plumbing routes

The object model must leave room for proper schematics later.

---

## 8. Projects and persistence

- Accounts, with projects tied to the account rather than the browser
- Multiple projects per user; create, rename, duplicate, delete
- Autosave; no explicit save button
- User settings persist across projects: height, units, which warnings are
  enabled

### Units

Metric and imperial both, switchable. Van dimensions come from both US and
European sources and users are split. Store canonically in millimetres, convert
for display.

---

## 9. Non-functional

- Responsive: usable on a laptop and a phone without separate codepaths
- Editor interactions (drag, resize, slider) must feel immediate — no network
  round-trip per pointer move; debounce persistence
- Undo/redo in the editor
- No data loss on refresh or navigation

---

## 10. Out of scope for v1

- 3D view (deferred, but the object model supports it)
- Build sequencing, task lists, install order (deferred — this is the "building"
  half of the eventual product)
- Cut lists and material takeoffs
- Full electrical/plumbing schematics
- Collaboration, sharing, multi-user projects
- Export (PDF, image, shareable link)
- Payments or monetization

---

## 11. Open questions

- Grid and snap interval for the editor — 10mm? User-configurable?
- Where do the seed van dimensions come from, and who verifies them?
- Do community-submitted dimension corrections feed back into the shared preset
  library, or stay local to a project?
- What's the minimum set of van models for a credible launch?

---

## Build order

1. Object model with full 3D bounds and units handling — get this right first,
   everything else depends on it
2. Top-down editor: place, move, resize, rotate, delete. Custom van dimensions
   only, no presets yet
3. Persistence and projects
4. Side and rear elevation views driven by the same model
5. Height slider and ghosting
6. Rules engine: hard conflicts first, then ergonomic warnings, then weight
7. Van presets with fixed obstacles
8. Articulated objects and swing arcs
9. Layers
10. Templates
11. Systems connection points