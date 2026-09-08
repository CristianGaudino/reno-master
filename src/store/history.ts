/**
 * Undo/redo.
 *
 * Snapshot-based over the object list. A van scene is tens of objects, so a
 * snapshot is a few kilobytes and 100 of them cost less than a single photo —
 * far simpler to reason about than inverse commands, and it cannot drift out of
 * sync with the state it describes the way a hand-written undo of a rotate can.
 *
 * The important behaviour is coalescing: a drag is one entry, not one per
 * pointermove. Without that, undo becomes useless after ten seconds of nudging.
 */

import { HISTORY_LIMIT } from '../lib/config'
import type { VanObject } from '../lib/definitions'

export interface HistoryEntry {
  objects: VanObject[]
  selectedIds: string[]
  /** Groups consecutive edits that should undo together, e.g. one drag. */
  label: string
}

export interface History {
  past: HistoryEntry[]
  future: HistoryEntry[]
}

export const emptyHistory: History = { past: [], future: [] }

/**
 * Record a state before it is changed.
 *
 * `coalesceKey` merges consecutive pushes: while a drag is in progress every
 * pointermove calls this with the same key, and only the first is kept. Passing
 * a fresh key (or none) starts a new undo step.
 */
export function pushHistory(
  history: History,
  entry: HistoryEntry,
  coalesceKey?: string,
  lastKey?: string,
): { history: History; key: string | undefined } {
  if (coalesceKey && coalesceKey === lastKey) {
    return { history, key: coalesceKey }
  }

  const past = [...history.past, entry]
  if (past.length > HISTORY_LIMIT) past.shift()

  // Any new edit invalidates the redo stack — the future being undone to no
  // longer exists.
  return { history: { past, future: [] }, key: coalesceKey }
}

export function undo(
  history: History,
  current: HistoryEntry,
): { history: History; entry: HistoryEntry } | null {
  const previous = history.past[history.past.length - 1]
  if (!previous) return null

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
    entry: previous,
  }
}

export function redo(
  history: History,
  current: HistoryEntry,
): { history: History; entry: HistoryEntry } | null {
  const next = history.future[0]
  if (!next) return null

  return {
    history: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
    entry: next,
  }
}

export function canUndo(history: History): boolean {
  return history.past.length > 0
}

export function canRedo(history: History): boolean {
  return history.future.length > 0
}
