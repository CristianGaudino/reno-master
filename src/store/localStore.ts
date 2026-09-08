/**
 * IndexedDB: the editor's real write path.
 *
 * Every mutation lands here immediately. This is what actually delivers the
 * spec's "no data loss on refresh or navigation" — it survives refresh,
 * navigation, tab close and a browser crash, with no network involved and
 * nothing to debounce. Neon is a periodic checkpoint on top of it, not the
 * primary store.
 *
 * What this does not survive: losing the machine, clearing site data, or opening
 * the project on a different device. Those are covered only up to the last
 * successful sync, which is the trade-off documented in `config.ts`.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { IDB_NAME, IDB_VERSION } from '../lib/config'
import type { Project, VanObject } from '../lib/definitions'

/** A project's local state, including what still needs sending to the server. */
export interface LocalScene {
  projectId: string
  project: Project
  objects: VanObject[]
  /**
   * The server revision this local state was built on. Sent as `baseRevision`
   * so the server can refuse a delta built on someone else's stale view.
   */
  baseRevision: number
  /** Object ids changed since the last successful sync. */
  dirtyIds: string[]
  /** Object ids deleted since the last successful sync. */
  deletedIds: string[]
  /** True when the project row itself changed (rename, van swap, overrides). */
  projectDirty: boolean
  /** Wall-clock time of the last successful sync, for the status indicator. */
  lastSyncedAt: number | null
  /**
   * The id the next sync will carry, generated in advance and stored here.
   *
   * It has to exist *before* the page starts unloading: a `pagehide` flush goes
   * out through sendBeacon, which cannot report success, and an IndexedDB write
   * at that moment is not guaranteed to complete. Pre-committing the id means
   * that when the project is next opened we can compare it against the project's
   * `lastSyncId` and tell "my parting save landed" from "someone else edited
   * this".
   */
  nextSyncId: string
  updatedAt: number
}

interface PlannerDB extends DBSchema {
  scenes: {
    key: string
    value: LocalScene
  }
}

let dbPromise: Promise<IDBPDatabase<PlannerDB>> | null = null

function database(): Promise<IDBPDatabase<PlannerDB>> {
  dbPromise ??= openDB<PlannerDB>(IDB_NAME, IDB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('scenes')) {
        db.createObjectStore('scenes', { keyPath: 'projectId' })
      }
    },
  })
  return dbPromise
}

/**
 * Whether local storage is usable at all.
 *
 * Private windows and hardened browser settings can refuse IndexedDB outright.
 * When that happens the editor still works — it just loses the offline safety
 * net, and the UI says so rather than pretending everything is saved.
 */
export async function isLocalStorageAvailable(): Promise<boolean> {
  try {
    await database()
    return true
  } catch {
    return false
  }
}

export async function readScene(projectId: string): Promise<LocalScene | null> {
  try {
    const db = await database()
    return (await db.get('scenes', projectId)) ?? null
  } catch (error) {
    console.warn('Could not read local scene', error)
    return null
  }
}

export async function writeScene(scene: LocalScene): Promise<void> {
  try {
    const db = await database()
    await db.put('scenes', { ...scene, updatedAt: Date.now() })
  } catch (error) {
    // Never let a storage failure break the editor: the in-memory store is
    // still authoritative for this session, and the sync engine will still
    // reach the server.
    console.warn('Could not write local scene', error)
  }
}

export async function clearScene(projectId: string): Promise<void> {
  try {
    const db = await database()
    await db.delete('scenes', projectId)
  } catch (error) {
    console.warn('Could not clear local scene', error)
  }
}

export async function listLocalScenes(): Promise<LocalScene[]> {
  try {
    const db = await database()
    return await db.getAll('scenes')
  } catch {
    return []
  }
}

/**
 * Decide what to show when a project is opened.
 *
 * If the local copy has unsynced work, it wins and the user is told; otherwise
 * the server copy is authoritative. The one case that needs a human is local
 * changes sitting on top of a revision the server has since moved past — that is
 * a genuine fork, and silently picking a side would throw away someone's work.
 */
export type SceneSource =
  | { kind: 'server'; reason: 'no-local' | 'local-clean' | 'local-stale' | 'beacon-landed' }
  | { kind: 'local'; reason: 'unsynced' }
  | { kind: 'conflict'; localRevision: number; serverRevision: number }

export function chooseScene(
  local: LocalScene | null,
  serverRevision: number,
  serverLastSyncId: string | null,
): SceneSource {
  if (!local) return { kind: 'server', reason: 'no-local' }

  // Our own parting save landed after all. Without this check, the ordinary act
  // of closing a tab and coming back would raise a conflict against yourself —
  // the server moved on by exactly the write we sent it and could not confirm.
  if (serverLastSyncId !== null && serverLastSyncId === local.nextSyncId) {
    return { kind: 'server', reason: 'beacon-landed' }
  }

  const hasPendingWork =
    local.dirtyIds.length > 0 || local.deletedIds.length > 0 || local.projectDirty

  if (!hasPendingWork) {
    return {
      kind: 'server',
      reason: local.baseRevision === serverRevision ? 'local-clean' : 'local-stale',
    }
  }

  // Unsynced edits built on the revision the server still holds: the local copy
  // is simply ahead, so use it and let the next sync catch up.
  if (local.baseRevision === serverRevision) {
    return { kind: 'local', reason: 'unsynced' }
  }

  // Unsynced edits built on an older revision: both sides have changes.
  return {
    kind: 'conflict',
    localRevision: local.baseRevision,
    serverRevision,
  }
}
