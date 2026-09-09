/**
 * The editor's state.
 *
 * Local-first: this store is authoritative while editing. Every mutation writes
 * through to IndexedDB immediately and marks the object dirty; the sync engine
 * ships the accumulated delta to Neon on its own schedule.
 *
 * Warnings are recomputed from this state on every change rather than on
 * pointerup, so a conflict appears while you are still dragging. At van scale
 * (tens of objects) the whole rule pass is a fraction of a frame, and live
 * feedback is the entire point of the tool.
 */

import { create } from 'zustand'
import {
  DEFAULT_CUT_HEIGHT_MM,
  DEFAULT_GRID_MM,
} from '../lib/config'
import type {
  CatalogItem,
  Project,
  RuleLayer,
  ResolvedVan,
  Size3,
  UserSettings,
  VanModel,
  VanObject,
  Vec3,
  ViewMode,
} from '../lib/definitions'
import { articulationFromTemplate, transformArticulation } from '../lib/geometry'
import { resolveVan } from '../lib/resolveVan'
import { massAfterResize } from '../lib/customPieces'
import { ALL_LAYERS } from '../lib/constants'
import { instantiateTemplate, type Template } from '../lib/templates'
import {
  canRedo,
  canUndo,
  emptyHistory,
  pushHistory,
  redo,
  undo,
  type History,
  type HistoryEntry,
} from './history'
import { readScene, writeScene, type LocalScene } from './localStore'

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'

interface EditorState {
  // Scene ------------------------------------------------------------------
  projectId: string | null
  project: Project | null
  vanModel: VanModel | null
  /**
   * The preset library.
   *
   * Held here so the store can re-resolve the van on its own when the project
   * switches model. Without it `patchProject` had only the previously loaded
   * model to work from, so changing the vehicle changed the id and nothing
   * else — same dimensions, same label, same obstacles.
   */
  vanModels: VanModel[]
  van: ResolvedVan | null
  objects: VanObject[]
  settings: UserSettings

  // View -------------------------------------------------------------------
  view: ViewMode
  cutHeight: number
  ghostingEnabled: boolean
  selectedIds: string[]
  hoveredFindingId: string | null
  /** Layers currently drawn. Spec section 1: overlays on the same plan. */
  visibleLayers: RuleLayer[]
  /** Draw inferred cable and pipe runs for the visible system layers. */
  showRuns: boolean
  /**
   * Manufactured items the user has explicitly unlocked for resizing.
   *
   * Deliberately not persisted. Once they actually change a dimension the piece
   * reads as custom on its own and stays unlocked; until then, re-locking on
   * reload is the right default — the lock exists to stop an accidental drag
   * redefining an appliance.
   */
  unlockedIds: string[]

  // History ----------------------------------------------------------------
  history: History
  lastCoalesceKey: string | undefined

  // Sync -------------------------------------------------------------------
  baseRevision: number
  dirtyIds: Set<string>
  deletedIds: Set<string>
  projectDirty: boolean
  syncStatus: SyncStatus
  syncError: string | null
  lastSyncedAt: number | null
  serverRevisionOnConflict: number | null
  /** Pre-generated id the next sync will carry; see localStore. */
  nextSyncId: string

  // Actions ----------------------------------------------------------------
  hydrate(input: {
    project: Project
    objects: VanObject[]
    vanModel: VanModel | null
    vanModels: VanModel[]
    settings: UserSettings
    fromLocal: LocalScene | null
  }): void
  reset(): void

  setView(view: ViewMode): void
  setCutHeight(height: number): void
  setGhosting(enabled: boolean): void
  select(ids: string[]): void
  toggleSelection(id: string): void
  setHoveredFinding(id: string | null): void
  toggleLayer(layer: RuleLayer): void
  setShowRuns(show: boolean): void
  unlockResize(id: string): void
  nudgeSelection(delta: Partial<Vec3>): void
  selectNext(step: number): void
  applyTemplate(template: Template): void

  addFromCatalog(item: CatalogItem, position: Vec3): string
  addCustomObject(object: Omit<VanObject, 'id' | 'projectId'>): string
  patchObjects(
    ids: string[],
    patch: (object: VanObject) => Partial<VanObject>,
    coalesceKey?: string,
  ): void
  moveObjects(ids: string[], delta: Partial<Vec3>, coalesceKey?: string): void
  placeObjects(
    placements: Array<{ id: string; position: Vec3 }>,
    coalesceKey?: string,
  ): void
  resizeObject(id: string, size: Partial<Size3>, position?: Partial<Vec3>, coalesceKey?: string): void
  rotateObject(id: string, yaw: number, coalesceKey?: string): void
  deleteObjects(ids: string[]): void
  duplicateObjects(ids: string[]): void

  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean

  applySettings(settings: UserSettings): void
  patchProject(patch: Partial<Project>): void

  // Sync plumbing ----------------------------------------------------------
  takeDelta(): {
    upserts: VanObject[]
    deletes: string[]
    baseRevision: number
    projectDirty: boolean
    syncId: string
  }
  markSyncing(): void
  markSynced(revision: number, sent: VanObject[], deletedIds: string[]): void
  markSyncError(message: string): void
  markConflict(serverRevision: number): void
  hasPendingChanges(): boolean
}

const defaultSettings: UserSettings = {
  userId: '',
  heightMm: null,
  unitSystem: 'metric',
  disabledRules: [],
  gridMm: DEFAULT_GRID_MM,
  ghostingEnabled: true,
  snapToObjects: true,
}

export const useEditorStore = create<EditorState>((set, get) => {
  /**
   * Persist the current state locally.
   *
   * Called after every mutation. Deliberately not awaited: the store is already
   * updated and correct, and blocking an interaction on a disk write would make
   * dragging feel sticky.
   */
  const persist = () => {
    const state = get()
    if (!state.projectId || !state.project) return

    void writeScene({
      projectId: state.projectId,
      project: state.project,
      objects: state.objects,
      baseRevision: state.baseRevision,
      dirtyIds: [...state.dirtyIds],
      deletedIds: [...state.deletedIds],
      projectDirty: state.projectDirty,
      lastSyncedAt: state.lastSyncedAt,
      nextSyncId: state.nextSyncId,
      updatedAt: Date.now(),
    })
  }

  /** Snapshot for the undo stack. */
  const snapshot = (): HistoryEntry => ({
    objects: get().objects,
    selectedIds: get().selectedIds,
    label: 'edit',
  })

  /** Record history, apply the change, mark dirty, persist. */
  const commit = (
    next: VanObject[],
    touchedIds: string[],
    coalesceKey?: string,
    options: { removed?: string[]; select?: string[] } = {},
  ) => {
    const state = get()
    const { history, key } = pushHistory(
      state.history,
      snapshot(),
      coalesceKey,
      state.lastCoalesceKey,
    )

    const dirtyIds = new Set(state.dirtyIds)
    for (const id of touchedIds) dirtyIds.add(id)

    const deletedIds = new Set(state.deletedIds)
    for (const id of options.removed ?? []) {
      deletedIds.add(id)
      // No point sending an update for something we are also deleting.
      dirtyIds.delete(id)
    }

    set({
      objects: next,
      history,
      lastCoalesceKey: key,
      dirtyIds,
      deletedIds,
      syncStatus: state.syncStatus === 'conflict' ? 'conflict' : 'pending',
      ...(options.select ? { selectedIds: options.select } : {}),
    })

    persist()
  }

  return {
    projectId: null,
    project: null,
    vanModel: null,
    vanModels: [],
    van: null,
    objects: [],
    settings: defaultSettings,

    view: 'top',
    cutHeight: DEFAULT_CUT_HEIGHT_MM,
    ghostingEnabled: true,
    selectedIds: [],
    hoveredFindingId: null,
    visibleLayers: [...ALL_LAYERS],
    showRuns: true,
    unlockedIds: [],

    history: emptyHistory,
    lastCoalesceKey: undefined,

    baseRevision: 0,
    dirtyIds: new Set(),
    deletedIds: new Set(),
    projectDirty: false,
    syncStatus: 'idle',
    syncError: null,
    lastSyncedAt: null,
    serverRevisionOnConflict: null,
    nextSyncId: crypto.randomUUID(),

    hydrate({ project, objects, vanModel, vanModels, settings, fromLocal }) {
      const useLocal = fromLocal !== null

      set({
        projectId: project.id,
        project: useLocal ? fromLocal.project : project,
        vanModel,
        vanModels,
        van: resolveVan(useLocal ? fromLocal.project : project, vanModel),
        objects: useLocal ? fromLocal.objects : objects,
        settings,
        ghostingEnabled: settings.ghostingEnabled,
        selectedIds: [],
        history: emptyHistory,
        lastCoalesceKey: undefined,
        baseRevision: useLocal ? fromLocal.baseRevision : project.revision,
        dirtyIds: new Set(useLocal ? fromLocal.dirtyIds : []),
        deletedIds: new Set(useLocal ? fromLocal.deletedIds : []),
        projectDirty: useLocal ? fromLocal.projectDirty : false,
        syncStatus: useLocal && fromLocal.dirtyIds.length > 0 ? 'pending' : 'idle',
        syncError: null,
        lastSyncedAt: useLocal ? fromLocal.lastSyncedAt : Date.now(),
        serverRevisionOnConflict: null,
        // Reuse the stored id when resuming local work so a beacon that is
        // still in flight stays recognisable; otherwise start a fresh one.
        nextSyncId: useLocal ? fromLocal.nextSyncId : crypto.randomUUID(),
      })
    },

    reset() {
      set({
        projectId: null,
        project: null,
        vanModel: null,
        van: null,
        objects: [],
        selectedIds: [],
        history: emptyHistory,
        dirtyIds: new Set(),
        deletedIds: new Set(),
        projectDirty: false,
        syncStatus: 'idle',
        syncError: null,
        serverRevisionOnConflict: null,
      })
    },

    setView(view) {
      set({ view, selectedIds: get().selectedIds })
    },

    setCutHeight(cutHeight) {
      set({ cutHeight })
    },

    setGhosting(ghostingEnabled) {
      set({ ghostingEnabled })
    },

    select(selectedIds) {
      set({ selectedIds, lastCoalesceKey: undefined })
    },

    toggleSelection(id) {
      const current = get().selectedIds
      set({
        selectedIds: current.includes(id)
          ? current.filter((existing) => existing !== id)
          : [...current, id],
      })
    },

    setHoveredFinding(hoveredFindingId) {
      set({ hoveredFindingId })
    },

    toggleLayer(layer) {
      const current = get().visibleLayers
      set({
        visibleLayers: current.includes(layer)
          ? current.filter((existing) => existing !== layer)
          : [...current, layer],
      })
    },

    setShowRuns(showRuns) {
      set({ showRuns })
    },

    unlockResize(id) {
      const current = get().unlockedIds
      if (current.includes(id)) return
      set({ unlockedIds: [...current, id] })
    },

    /**
     * Move the selection by an exact amount.
     *
     * Dragging is good for roughing a layout out and hopeless for the last
     * five millimetres. Arrow keys move by the snap grid, which is the only way
     * to place something precisely without typing coordinates into a field.
     *
     * Each press is its own undo entry — unlike a drag, which coalesces —
     * because a press is already a discrete decision.
     */
    nudgeSelection(delta) {
      const state = get()
      if (state.selectedIds.length === 0) return

      const selected = new Set(state.selectedIds)
      const placements = state.objects
        .filter((object) => selected.has(object.id))
        .map((object) => ({
          id: object.id,
          position: {
            x: object.position.x + (delta.x ?? 0),
            y: object.position.y + (delta.y ?? 0),
            z: object.position.z + (delta.z ?? 0),
          },
        }))

      state.placeObjects(placements)
    },

    /**
     * Step through the objects with the keyboard.
     *
     * Without this the canvas is reachable but its contents are not: everything
     * in the van could only ever be selected by pointing at it.
     */
    selectNext(step) {
      const state = get()
      if (state.objects.length === 0) return

      const ordered = [...state.objects].sort((a, b) => a.zIndex - b.zIndex)
      const current = ordered.findIndex((object) => state.selectedIds.includes(object.id))

      const next =
        current === -1
          ? step > 0
            ? 0
            : ordered.length - 1
          : (current + step + ordered.length) % ordered.length

      set({ selectedIds: [ordered[next]!.id] })
    },

    /**
     * Load a template into the project.
     *
     * Spec section 5: templates fork. The objects are copied in with fresh ids
     * and no reference to where they came from, so editing them afterwards is
     * ordinary editing and a later change to the template cannot reach back into
     * this build.
     *
     * It replaces what is there rather than merging, because merging two layouts
     * produces a pile rather than a plan.
     */
    applyTemplate(template) {
      const state = get()
      if (!state.projectId || !state.van) return

      const objects = instantiateTemplate(template, state.van, state.projectId)
      const removed = state.objects.map((object) => object.id)

      commit(objects, objects.map((object) => object.id), undefined, {
        removed,
        select: [],
      })
    },

    addFromCatalog(item, position) {
      const state = get()
      if (!state.projectId) return ''

      const id = crypto.randomUUID()
      const object: VanObject = {
        id,
        projectId: state.projectId,
        name: item.name,
        category: item.category,
        kind: item.kind,
        position,
        size: { ...item.size },
        yaw: 0,
        mass: item.mass,
        cost: item.cost,
        color: item.color,
        articulation: item.articulationTemplate
          ? articulationFromTemplate(item.articulationTemplate, position, item.size, 0)
          : null,
        connections: [],
        zIndex: state.objects.length,
        notes: null,
        catalogSlug: item.slug,
      }

      commit([...state.objects, object], [id], undefined, { select: [id] })
      return id
    },

    addCustomObject(input) {
      const state = get()
      if (!state.projectId) return ''

      const id = crypto.randomUUID()
      const object: VanObject = { ...input, id, projectId: state.projectId }
      commit([...state.objects, object], [id], undefined, { select: [id] })
      return id
    },

    patchObjects(ids, patch, coalesceKey) {
      const state = get()
      const idSet = new Set(ids)

      const next = state.objects.map((object) => {
        if (!idSet.has(object.id)) return object
        return { ...object, ...patch(object) }
      })

      commit(next, ids, coalesceKey)
    },

    moveObjects(ids, delta, coalesceKey) {
      const state = get()
      const idSet = new Set(ids)

      const next = state.objects.map((object) => {
        if (!idSet.has(object.id)) return object

        const position: Vec3 = {
          x: object.position.x + (delta.x ?? 0),
          y: object.position.y + (delta.y ?? 0),
          z: object.position.z + (delta.z ?? 0),
        }

        return {
          ...object,
          position,
          // A door has to travel with the cabinet it hangs on.
          articulation: object.articulation
            ? transformArticulation(
                object.articulation,
                { position: object.position, size: object.size, yaw: object.yaw },
                { position, size: object.size, yaw: object.yaw },
              )
            : null,
        }
      })

      commit(next, ids, coalesceKey)
    },

    /**
     * Set absolute positions.
     *
     * Used by dragging, where each pointermove is computed from the gesture's
     * starting positions rather than accumulated from the last frame — that way
     * a snap correction on one frame does not bias the next.
     *
     * Articulation is transformed here rather than by the caller, so a fridge
     * door stays welded to its fridge for the whole drag rather than snapping
     * back into place on release.
     */
    placeObjects(placements, coalesceKey) {
      const state = get()
      const byId = new Map(placements.map((placement) => [placement.id, placement.position]))

      const next = state.objects.map((object) => {
        const position = byId.get(object.id)
        if (!position) return object

        return {
          ...object,
          position,
          articulation: object.articulation
            ? transformArticulation(
                object.articulation,
                { position: object.position, size: object.size, yaw: object.yaw },
                { position, size: object.size, yaw: object.yaw },
              )
            : null,
        }
      })

      commit(next, [...byId.keys()], coalesceKey)
    },

    resizeObject(id, size, position, coalesceKey) {
      const state = get()

      const next = state.objects.map((object) => {
        if (object.id !== id) return object

        const nextSize: Size3 = { ...object.size, ...size }
        const nextPosition: Vec3 = { ...object.position, ...position }

        return {
          ...object,
          size: nextSize,
          position: nextPosition,
          // A tank made bigger holds more water, and water is usually the
          // heaviest thing in the van — leaving the old figure would quietly
          // put the payload numbers out.
          mass: massAfterResize(object, nextSize),
          articulation: object.articulation
            ? transformArticulation(
                object.articulation,
                { position: object.position, size: object.size, yaw: object.yaw },
                { position: nextPosition, size: nextSize, yaw: object.yaw },
              )
            : null,
        }
      })

      commit(next, [id], coalesceKey)
    },

    rotateObject(id, yaw, coalesceKey) {
      const state = get()

      const next = state.objects.map((object) => {
        if (object.id !== id) return object

        return {
          ...object,
          yaw,
          articulation: object.articulation
            ? transformArticulation(
                object.articulation,
                { position: object.position, size: object.size, yaw: object.yaw },
                { position: object.position, size: object.size, yaw },
              )
            : null,
        }
      })

      commit(next, [id], coalesceKey)
    },

    deleteObjects(ids) {
      const state = get()
      const idSet = new Set(ids)
      const next = state.objects.filter((object) => !idSet.has(object.id))

      commit(next, [], undefined, { removed: ids, select: [] })
    },

    duplicateObjects(ids) {
      const state = get()
      const idSet = new Set(ids)

      const copies: VanObject[] = []
      for (const object of state.objects) {
        if (!idSet.has(object.id)) continue

        const id = crypto.randomUUID()
        // Offset so the copy is visible rather than exactly hidden underneath.
        const position: Vec3 = {
          x: object.position.x + 100,
          y: object.position.y + 100,
          z: object.position.z,
        }

        copies.push({
          ...object,
          id,
          position,
          name: `${object.name} copy`,
          zIndex: state.objects.length + copies.length,
          articulation: object.articulation
            ? transformArticulation(
                object.articulation,
                { position: object.position, size: object.size, yaw: object.yaw },
                { position, size: object.size, yaw: object.yaw },
              )
            : null,
        })
      }

      if (copies.length === 0) return

      commit(
        [...state.objects, ...copies],
        copies.map((copy) => copy.id),
        undefined,
        { select: copies.map((copy) => copy.id) },
      )
    },

    undo() {
      const state = get()
      const result = undo(state.history, snapshot())
      if (!result) return

      // Everything present in either state may have changed, so mark both sides
      // dirty — the delta has to describe the world as it now is.
      const touched = new Set<string>()
      for (const object of state.objects) touched.add(object.id)
      for (const object of result.entry.objects) touched.add(object.id)

      const surviving = new Set(result.entry.objects.map((object) => object.id))
      const dirtyIds = new Set(state.dirtyIds)
      const deletedIds = new Set(state.deletedIds)

      for (const id of touched) {
        if (surviving.has(id)) {
          dirtyIds.add(id)
          deletedIds.delete(id)
        } else {
          dirtyIds.delete(id)
          deletedIds.add(id)
        }
      }

      set({
        objects: result.entry.objects,
        selectedIds: result.entry.selectedIds,
        history: result.history,
        lastCoalesceKey: undefined,
        dirtyIds,
        deletedIds,
        syncStatus: 'pending',
      })

      persist()
    },

    redo() {
      const state = get()
      const result = redo(state.history, snapshot())
      if (!result) return

      const touched = new Set<string>()
      for (const object of state.objects) touched.add(object.id)
      for (const object of result.entry.objects) touched.add(object.id)

      const surviving = new Set(result.entry.objects.map((object) => object.id))
      const dirtyIds = new Set(state.dirtyIds)
      const deletedIds = new Set(state.deletedIds)

      for (const id of touched) {
        if (surviving.has(id)) {
          dirtyIds.add(id)
          deletedIds.delete(id)
        } else {
          dirtyIds.delete(id)
          deletedIds.add(id)
        }
      }

      set({
        objects: result.entry.objects,
        selectedIds: result.entry.selectedIds,
        history: result.history,
        lastCoalesceKey: undefined,
        dirtyIds,
        deletedIds,
        syncStatus: 'pending',
      })

      persist()
    },

    canUndo: () => canUndo(get().history),
    canRedo: () => canRedo(get().history),

    applySettings(settings) {
      set({ settings, ghostingEnabled: settings.ghostingEnabled })
    },

    patchProject(patch) {
      const state = get()
      if (!state.project) return

      const project = { ...state.project, ...patch }

      // Re-look-up the model rather than reusing the loaded one: the patch may
      // have changed which van this project is.
      const vanModel = project.vanModelId
        ? (state.vanModels.find((model) => model.id === project.vanModelId) ?? null)
        : null

      set({
        project,
        vanModel,
        van: resolveVan(project, vanModel),
        projectDirty: true,
        syncStatus: 'pending',
      })
      persist()
    },

    takeDelta() {
      const state = get()
      const byId = new Map(state.objects.map((object) => [object.id, object]))

      const upserts: VanObject[] = []
      for (const id of state.dirtyIds) {
        const object = byId.get(id)
        if (object) upserts.push(object)
      }

      return {
        upserts,
        deletes: [...state.deletedIds],
        baseRevision: state.baseRevision,
        projectDirty: state.projectDirty,
        syncId: state.nextSyncId,
      }
    },

    markSyncing() {
      set({ syncStatus: 'saving', syncError: null })
    },

    /**
     * Clear only what was actually sent, and only if it has not changed since.
     *
     * Store objects are replaced rather than mutated on every edit, so an
     * identical reference means the object is exactly what went to the server.
     * A different reference means the user edited it while the request was in
     * flight — clearing that would drop the newer edit on the floor, and it
     * would never be sent again.
     */
    markSynced(revision, sent, deletedIds) {
      const state = get()
      const current = new Map(state.objects.map((object) => [object.id, object]))

      const dirtyIds = new Set(state.dirtyIds)
      for (const object of sent) {
        if (current.get(object.id) === object) dirtyIds.delete(object.id)
      }

      const stillDeleted = new Set(state.deletedIds)
      for (const id of deletedIds) stillDeleted.delete(id)

      set({
        baseRevision: revision,
        dirtyIds,
        deletedIds: stillDeleted,
        projectDirty: false,
        syncStatus: dirtyIds.size > 0 || stillDeleted.size > 0 ? 'pending' : 'saved',
        syncError: null,
        lastSyncedAt: Date.now(),
        serverRevisionOnConflict: null,
        // Rotate: this id has been used and is now recorded on the server row.
        nextSyncId: crypto.randomUUID(),
      })

      persist()
    },

    markSyncError(message) {
      set({ syncStatus: 'error', syncError: message })
    },

    markConflict(serverRevision) {
      set({
        syncStatus: 'conflict',
        serverRevisionOnConflict: serverRevision,
        syncError:
          'This project was changed somewhere else. Choose which version to keep.',
      })
    },

    hasPendingChanges() {
      const state = get()
      return state.dirtyIds.size > 0 || state.deletedIds.size > 0 || state.projectDirty
    },
  }
})

/** Load a previously stored local scene, if there is one. */
export async function loadLocalScene(projectId: string): Promise<LocalScene | null> {
  return readScene(projectId)
}
