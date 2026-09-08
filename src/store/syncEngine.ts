/**
 * The Neon checkpoint.
 *
 * The editor never waits on this. IndexedDB already holds every edit, so this is
 * about getting work off the machine — on a timer, when the user asks, and when
 * the page is going away.
 *
 * Triggers:
 *   - every SYNC_INTERVAL_MS while there is anything pending
 *   - Ctrl/Cmd-S, or the Save now button
 *   - the delta growing past SYNC_DIRTY_THRESHOLD objects
 *   - leaving the editor
 *   - `pagehide` / tab hidden, via sendBeacon
 */

import {
  SYNC_DIRTY_THRESHOLD,
  SYNC_INTERVAL_MS,
  SYNC_RETRY_DELAYS_MS,
} from '../lib/config'
import { ApiError, beaconSync, syncProject } from '../lib/api/client'
import { useEditorStore } from './editorStore'

let intervalId: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryIndex = 0
/** Guards against two flushes overlapping and sending the same delta twice. */
let inFlight = false

/**
 * Send whatever is pending.
 *
 * Returns true when the server accepted the delta. Safe to call at any time: it
 * no-ops when there is nothing to send or a request is already in flight.
 */
export async function flush(): Promise<boolean> {
  const store = useEditorStore.getState()

  if (inFlight) return false
  if (!store.projectId || !store.project) return false
  if (!store.hasPendingChanges()) return true
  // A conflict needs a human decision; retrying would just fail the same way.
  if (store.syncStatus === 'conflict') return false

  const delta = store.takeDelta()
  inFlight = true
  store.markSyncing()

  try {
    const result = await syncProject(store.projectId, {
      baseRevision: delta.baseRevision,
      syncId: delta.syncId,
      upserts: delta.upserts,
      deletes: delta.deletes,
      ...(delta.projectDirty
        ? {
            patch: {
              name: store.project.name,
              vanModelId: store.project.vanModelId,
              customInterior: store.project.customInterior,
              overrides: store.project.overrides,
            },
          }
        : {}),
    })

    if (!result.ok) {
      useEditorStore.getState().markConflict(result.serverRevision)
      return false
    }

    useEditorStore.getState().markSynced(result.revision, delta.upserts, delta.deletes)

    retryIndex = 0
    return true
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Could not reach the server. Your work is saved on this device.'

    useEditorStore.getState().markSyncError(message)
    scheduleRetry()
    return false
  } finally {
    inFlight = false
  }
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer)

  const delay = SYNC_RETRY_DELAYS_MS[Math.min(retryIndex, SYNC_RETRY_DELAYS_MS.length - 1)]!
  retryIndex += 1

  retryTimer = setTimeout(() => {
    void flush()
  }, delay)
}

/**
 * Last-chance flush as the page goes away.
 *
 * A normal fetch is cancelled when the document unloads, so this uses
 * `sendBeacon`, which the browser delivers on its own. It cannot report success,
 * so nothing is cleared from the dirty set — the next session will simply send
 * it again, and the upsert is idempotent.
 */
function flushOnUnload() {
  const store = useEditorStore.getState()
  if (!store.projectId || !store.hasPendingChanges()) return
  if (store.syncStatus === 'conflict') return

  const delta = store.takeDelta()
  beaconSync(store.projectId, {
    baseRevision: delta.baseRevision,
    // Pre-generated and already in IndexedDB, so the next load can recognise
    // this write as ours even though sendBeacon cannot tell us it succeeded.
    syncId: delta.syncId,
    upserts: delta.upserts,
    deletes: delta.deletes,
  })
}

/**
 * Start the engine for the current project. Returns a teardown function that
 * flushes once more on the way out.
 */
export function startSyncEngine(): () => void {
  stopSyncEngine()

  intervalId = setInterval(() => {
    const store = useEditorStore.getState()
    if (store.hasPendingChanges()) void flush()
  }, SYNC_INTERVAL_MS)

  // Commit early if a session turns into a lot of work, so a five-minute window
  // never accumulates an unbounded amount of unsent change.
  const unsubscribe = useEditorStore.subscribe((state, previous) => {
    if (state.dirtyIds === previous.dirtyIds) return
    if (state.dirtyIds.size + state.deletedIds.size >= SYNC_DIRTY_THRESHOLD) {
      void flush()
    }
  })

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushOnUnload()
  }

  window.addEventListener('pagehide', flushOnUnload)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener('pagehide', flushOnUnload)
    document.removeEventListener('visibilitychange', onVisibility)
    unsubscribe()
    stopSyncEngine()
    void flush()
  }
}

export function stopSyncEngine() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

/** Human-readable "last synced" text for the status indicator. */
export function describeLastSync(timestamp: number | null): string {
  if (!timestamp) return 'not yet synced'

  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 45) return 'synced just now'
  if (seconds < 90) return 'synced a minute ago'
  if (seconds < 3600) return `synced ${Math.round(seconds / 60)} minutes ago`
  if (seconds < 7200) return 'synced an hour ago'
  return `synced ${Math.round(seconds / 3600)} hours ago`
}
