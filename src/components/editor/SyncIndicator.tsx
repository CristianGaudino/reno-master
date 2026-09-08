/**
 * Sync status.
 *
 * With a five-minute commit interval, the user must never have to guess whether
 * their work has left the machine — so the state is always on screen, and "saved
 * on this device" is worded so it cannot be mistaken for "saved to the server".
 */

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../ui'
import { useEditorStore } from '../../store/editorStore'
import { describeLastSync, flush } from '../../store/syncEngine'

export function SyncIndicator() {
  const status = useEditorStore((state) => state.syncStatus)
  const lastSyncedAt = useEditorStore((state) => state.lastSyncedAt)
  const syncError = useEditorStore((state) => state.syncError)

  // Re-render on a timer so "synced 3 minutes ago" stays honest without the
  // store having to tick.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const label =
    status === 'saving'
      ? 'Saving…'
      : status === 'error'
        ? 'Saved on this device'
        : status === 'conflict'
          ? 'Changed elsewhere'
          : status === 'pending'
            ? `Saved on this device · ${describeLastSync(lastSyncedAt)}`
            : describeLastSync(lastSyncedAt)

  const tone =
    status === 'error' || status === 'conflict'
      ? 'text-warn'
      : status === 'pending'
        ? 'text-ink-muted'
        : 'text-[var(--color-good)]'

  return (
    <div className="flex items-center gap-2">
      <span className={cn('hidden text-xs sm:inline', tone)} title={syncError ?? undefined}>
        {label}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void flush()}
        disabled={status === 'saving' || status === 'conflict'}
        title="Save to the server now (Ctrl+S)"
      >
        Save now
      </Button>
    </div>
  )
}

/**
 * Conflict resolution.
 *
 * Shown when the server has moved on from the revision the local edits were
 * built on. Both sides have real work in them, so this asks rather than picking
 * — silently discarding either would be the worst outcome.
 */
export function ConflictBanner({ onReload }: { onReload(): void }) {
  const status = useEditorStore((state) => state.syncStatus)
  const serverRevision = useEditorStore((state) => state.serverRevisionOnConflict)
  const baseRevision = useEditorStore((state) => state.baseRevision)

  if (status !== 'conflict') return null

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-warn bg-warn-soft px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          This project was changed somewhere else
        </p>
        <p className="text-xs text-ink-muted">
          Another tab or device saved revision {serverRevision}; your edits are
          built on revision {baseRevision}. Nothing has been overwritten.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            // Rebase onto the server's revision and push local work over it.
            useEditorStore.setState({
              baseRevision: serverRevision ?? baseRevision,
              syncStatus: 'pending',
              syncError: null,
              serverRevisionOnConflict: null,
            })
            void flush()
          }}
        >
          Keep mine
        </Button>
        <Button size="sm" variant="secondary" onClick={onReload}>
          Load theirs
        </Button>
      </div>
    </div>
  )
}
