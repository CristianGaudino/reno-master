/**
 * The editor.
 *
 * Owns the load/hydrate handshake between the server copy and the local copy,
 * runs the sync engine for the lifetime of the route, and lays out the canvas
 * and its panels.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useProjectQuery, useSettings, useVanModel, useVanModels } from '../lib/api/queries'
import { chooseScene, clearScene, type LocalScene } from '../store/localStore'
import { loadLocalScene, useEditorStore } from '../store/editorStore'
import { flush, startSyncEngine } from '../store/syncEngine'
import { useFindings } from '../hooks/useFindings'
import { useMediaQuery, XL_QUERY } from '../hooks/useMediaQuery'
import { Canvas } from '../components/editor/Canvas'
import { CatalogPanel } from '../components/editor/CatalogPanel'
import { EditorToolbar, HeightSlider, LayerBar } from '../components/editor/EditorToolbar'
import { Inspector } from '../components/editor/Inspector'
import { WarningsPanel } from '../components/editor/WarningsPanel'
import { WeightPanel } from '../components/editor/WeightPanel'
import { TemplatePanel } from '../components/editor/TemplatePanel'
import { ProjectItemsPanel } from '../components/editor/ProjectItemsPanel'
import { ConflictBanner } from '../components/editor/SyncIndicator'
import { Button, Spinner } from '../components/ui'
import { cn } from '../lib/cn'

type MobileTab = 'catalog' | 'templates' | 'items' | 'properties' | 'checks'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const projectQuery = useProjectQuery(id)
  const settingsQuery = useSettings()
  const vanModelsQuery = useVanModels()
  const vanModel = useVanModel(projectQuery.data?.project.vanModelId)

  const hydrate = useEditorStore((state) => state.hydrate)
  const applySettings = useEditorStore((state) => state.applySettings)
  const reset = useEditorStore((state) => state.reset)
  const projectId = useEditorStore((state) => state.projectId)
  const settings = useEditorStore((state) => state.settings)

  const [dismissedRecovery, setDismissedRecovery] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('catalog')

  const report = useFindings()

  /**
   * Read whatever this device already has for the project.
   *
   * Kept in the query layer rather than an effect so the async read is a
   * dependency of rendering, not a side effect of it — which lets hydration
   * below be a pure write to an external store.
   */
  const localSceneQuery = useQuery({
    queryKey: ['local-scene', id],
    queryFn: (): Promise<LocalScene | null> => loadLocalScene(id!),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  /**
   * Decide whether to open the server copy or the local one.
   *
   * Unsynced local work wins; a clean local copy defers to the server. The
   * genuine fork — local edits on top of a revision the server has since moved
   * past — surfaces as a conflict rather than being resolved silently.
   */
  const choice = useMemo(() => {
    if (!projectQuery.data || localSceneQuery.isLoading) return null
    return chooseScene(
      localSceneQuery.data ?? null,
      projectQuery.data.project.revision,
      projectQuery.data.project.lastSyncId,
    )
  }, [projectQuery.data, localSceneQuery.data, localSceneQuery.isLoading])

  /**
   * Hydration writes to the Zustand store and nothing else — an external system,
   * which is exactly what an effect is for.
   *
   * It runs once per project. Settings deliberately are not a dependency:
   * re-hydrating would rebuild the scene and wipe the undo history, so a
   * background settings refetch — or simply changing units — would quietly
   * discard the user's ability to undo. Settings flow in separately below.
   *
   * It also waits for the van preset library. Hydrating before the model has
   * arrived resolves the project to bare custom dimensions for a beat, and the
   * correction that follows would be a second hydrate with the same cost.
   */
  const hydratedFor = useRef<string | null>(null)

  const vanModelsReady =
    !projectQuery.data?.project.vanModelId || vanModelsQuery.isSuccess

  useEffect(() => {
    if (!projectQuery.data || !settingsQuery.data || !choice || !vanModelsReady) return
    if (hydratedFor.current === projectQuery.data.project.id) return

    hydratedFor.current = projectQuery.data.project.id

    hydrate({
      project: projectQuery.data.project,
      objects: projectQuery.data.objects,
      vanModel,
      settings: settingsQuery.data,
      fromLocal:
        choice.kind === 'local' || choice.kind === 'conflict'
          ? (localSceneQuery.data ?? null)
          : null,
    })

    if (choice.kind === 'conflict') {
      useEditorStore.getState().markConflict(choice.serverRevision)
    }
  }, [
    projectQuery.data,
    settingsQuery.data,
    localSceneQuery.data,
    choice,
    hydrate,
    vanModel,
    vanModelsReady,
  ])

  // Settings changes reach the store on their own, without touching the scene.
  useEffect(() => {
    if (settingsQuery.data) applySettings(settingsQuery.data)
  }, [settingsQuery.data, applySettings])

  const showRecoveryNotice = choice?.kind === 'local' && !dismissedRecovery

  // The sync engine only runs while the editor is mounted; leaving flushes.
  useEffect(() => {
    if (!projectId) return
    return startSyncEngine()
  }, [projectId])

  useEffect(() => () => reset(), [reset])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (typing) return

      const store = useEditorStore.getState()
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void flush()
      } else if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
      } else if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        store.duplicateObjects(store.selectedIds)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          event.preventDefault()
          store.deleteObjects(store.selectedIds)
        }
      } else if (event.key === 'Escape') {
        store.select([])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const reloadFromServer = useCallback(async () => {
    if (!id) return
    // Deliberately re-hydrates: the user asked to discard local work and take
    // the server's version, so the guard above must not stop it.
    await clearScene(id)
    await localSceneQuery.refetch()
    const refetched = await projectQuery.refetch()
    if (refetched.data && settingsQuery.data) {
      hydrate({
        project: refetched.data.project,
        objects: refetched.data.objects,
        vanModel,
        settings: settingsQuery.data,
        fromLocal: null,
      })
    }
  }, [hydrate, id, localSceneQuery, projectQuery, settingsQuery.data, vanModel])

  const unitSystem = settings.unitSystem
  const wide = useMediaQuery(XL_QUERY)

  if (projectQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted">
        <Spinner /> Loading project…
      </div>
    )
  }

  if (projectQuery.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-ink">That project could not be loaded.</p>
        <Button onClick={() => void projectQuery.refetch()}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <EditorToolbar unitSystem={unitSystem} />
      <ConflictBanner onReload={() => void reloadFromServer()} />

      {showRecoveryNotice && (
        <div className="flex items-center gap-3 border-b border-border bg-accent-soft px-3 py-1.5">
          <p className="flex-1 text-xs text-ink">
            Restored unsaved changes from this device.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setDismissedRecovery(true)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Catalog: a fixed rail on wide screens, a tab below the canvas otherwise. */}
        {wide && (
          <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border p-2">
            <CatalogPanel unitSystem={unitSystem} className="min-h-0 flex-1" />
            <TemplatePanel className="shrink-0" />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <Canvas findings={report.findings} />
          <HeightSlider unitSystem={unitSystem} />
          <LayerBar />
        </main>

        {/*
          One layout is rendered, not both. Rendering the panels twice and hiding
          a copy with CSS doubles the store subscriptions and leaves two fields
          with the same label in the page.
        */}
        {wide && (
          <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto border-l border-border p-2">
            <Inspector unitSystem={unitSystem} className="shrink-0" />
            <WeightPanel unitSystem={unitSystem} className="shrink-0" />
            <ProjectItemsPanel unitSystem={unitSystem} className="shrink-0" />
            <WarningsPanel report={report} unitSystem={unitSystem} className="shrink-0" />
          </aside>
        )}
      </div>

      {!wide && (
        <div className="flex flex-col">
          <nav className="flex shrink-0 overflow-x-auto border-t border-border bg-surface-raised">
            {(['catalog', 'templates', 'items', 'properties', 'checks'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                className={cn(
                  'flex-1 px-2 py-2 text-xs font-medium whitespace-nowrap capitalize transition-colors',
                  mobileTab === tab
                    ? 'border-t-2 border-accent text-ink'
                    : 'border-t-2 border-transparent text-ink-muted',
                )}
              >
                {tab}
                {tab === 'checks' && report.errorCount > 0 && (
                  <span className="ml-1.5 rounded bg-danger px-1 text-[0.625rem] text-white">
                    {report.errorCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex h-64 flex-col border-t border-border p-2">
            {mobileTab === 'catalog' && (
              <CatalogPanel unitSystem={unitSystem} className="min-h-0 flex-1" />
            )}
            {mobileTab === 'templates' && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <TemplatePanel />
              </div>
            )}
            {mobileTab === 'items' && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ProjectItemsPanel unitSystem={unitSystem} />
              </div>
            )}
            {mobileTab === 'properties' && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Inspector unitSystem={unitSystem} />
              </div>
            )}
            {mobileTab === 'checks' && (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                <WeightPanel unitSystem={unitSystem} />
                <WarningsPanel report={report} unitSystem={unitSystem} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
