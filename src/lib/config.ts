/**
 * Tunables and environment-derived configuration.
 *
 * Anything true by definition (mm per inch, the 6'0" standard) belongs in
 * `constants.ts`. Anything here is a knob: changing it changes behaviour but
 * breaks nothing.
 *
 * This module is imported by the browser, so it must stay free of `process.env`.
 * Server-side environment accessors live in `config.server.ts`.
 */

import type { Mm } from './definitions'

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/**
 * How often accumulated edits are committed to Neon.
 *
 * The editor is local-first: every mutation lands in IndexedDB immediately, and
 * this interval controls only the durable checkpoint. The trade-off is that up
 * to this much work exists solely in the browser's storage — safe against
 * refresh, navigation, tab close and a browser crash, but not against losing the
 * machine or continuing on another device. Lower it if that matters more than
 * request volume.
 */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000

/** Commit early if the pending delta grows past this many objects. */
export const SYNC_DIRTY_THRESHOLD = 40

/** Give up on a sync request after this long and retry on the next trigger. */
export const SYNC_REQUEST_TIMEOUT_MS = 15_000

/** Backoff schedule for failed syncs, in milliseconds. */
export const SYNC_RETRY_DELAYS_MS = [2_000, 10_000, 30_000]

/** Base path the API is served from; the Vite dev server proxies this. */
export const API_BASE = '/api'

// ---------------------------------------------------------------------------
// Local storage
// ---------------------------------------------------------------------------

export const IDB_NAME = 'van-build-planner'
export const IDB_VERSION = 1

// ---------------------------------------------------------------------------
// Editor defaults
// ---------------------------------------------------------------------------

/**
 * Default snap interval. Spec open question, answered: 10mm by default and
 * user-configurable in settings.
 */
export const DEFAULT_GRID_MM: Mm = 10

export const GRID_OPTIONS_MM: Mm[] = [1, 5, 10, 25, 50]

/** Distance within which an edge snaps to a wall, obstacle or neighbour. */
export const SNAP_TOLERANCE_MM: Mm = 15

/** Undo history depth. A drag gesture is one entry, not one per pointermove. */
export const HISTORY_LIMIT = 100

/** Zoom bounds, expressed as screen pixels per millimetre. */
export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 3
export const ZOOM_STEP = 1.15

/** Padding around the van when the view is fitted to the viewport, in mm. */
export const FIT_PADDING_MM: Mm = 300

/** Below this pointer movement a drag is treated as a click. */
export const DRAG_THRESHOLD_PX = 3

/** Selection handle size in screen pixels; enlarged for coarse pointers. */
export const HANDLE_SIZE_PX = 8
export const HANDLE_SIZE_TOUCH_PX = 14

/** Default cut height for the section slider, roughly worktop level. */
export const DEFAULT_CUT_HEIGHT_MM: Mm = 900

/** Opacity applied to objects sitting entirely above the section cut. */
export const GHOST_OPACITY = 0.28

// ---------------------------------------------------------------------------
// Defaults for new projects
// ---------------------------------------------------------------------------

/**
 * Fallback interior for a project with no preset selected. Roughly a
 * medium-wheelbase high-roof panel van — a sane starting canvas, not a claim
 * about any particular vehicle.
 */
export const DEFAULT_CUSTOM_INTERIOR = { w: 1750, d: 3100, h: 1900 } as const

/** Payload assumed for a custom van until the user enters a real figure. */
export const DEFAULT_CUSTOM_PAYLOAD_G = 1_200_000
