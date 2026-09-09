/**
 * TanStack Query bindings for the API.
 *
 * Server state only. The editor's own state — objects, selection, view, undo —
 * lives in the Zustand store, because it changes on every pointermove and is
 * local-first by design. Mixing the two would mean either fighting the cache on
 * every drag or losing the offline guarantee.
 *
 * So the split is: this file owns anything the server is authoritative for
 * (project list, van presets, settings); `store/` owns the scene being edited.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import type {
  CreateProjectInput,
  Project,
  ProjectSummary,
  UpdateSettingsInput,
  UserSettings,
  VanModel,
} from '../definitions'
import { useNotify } from '../../hooks/useNotify'
import { ApiError } from './client'
import {
  createCatalogItem,
  createProject,
  duplicateProject,
  fetchCatalogItems,
  fetchProject,
  fetchProjects,
  fetchSettings,
  fetchVanModels,
  patchProject,
  patchSettings,
  removeCatalogItem,
  removeProject,
} from './client'

/**
 * Turn a failure into something worth reading.
 *
 * A raw fetch rejection says "Failed to fetch", which tells the user nothing
 * about whether their work is safe. Everything the editor does is held locally
 * first, so the honest reassurance is that nothing has been lost.
 */
export function describeMutationError(
  error: unknown,
  action: string,
): { message: string; detail: string } {
  const status = error instanceof ApiError ? error.status : 0

  if (status === 0) {
    return {
      message: `Could not ${action} — no connection to the server`,
      detail: 'Your work is still saved on this device. Try again when you are back online.',
    }
  }
  if (status === 404) {
    return {
      message: `Could not ${action} — it no longer exists`,
      detail: 'It may have been deleted in another tab.',
    }
  }
  if (status === 409) {
    return {
      message: `Could not ${action} — it was changed somewhere else`,
      detail: 'Reload to pick up the other version.',
    }
  }
  return {
    message: `Could not ${action}`,
    detail: error instanceof Error ? error.message : 'The server rejected the request.',
  }
}

export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  vanModels: ['van-models'] as const,
  catalog: ['catalog'] as const,
  settings: ['settings'] as const,
}

/**
 * The preset library is identical for everyone and changes only when the seed
 * script runs, so it is cached hard rather than refetched per navigation.
 */
export function useVanModels() {
  return useQuery({
    queryKey: queryKeys.vanModels,
    queryFn: fetchVanModels,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: fetchProjects })
}

export function useProjectQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(id ?? ''),
    queryFn: () => fetchProject(id!),
    enabled: Boolean(id),
    // The editor takes ownership of the scene once it has loaded it, and refetching
    // underneath an in-progress edit would fight the local-first store.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Pieces the user has saved for reuse. */
export function useUserCatalog() {
  return useQuery({ queryKey: queryKeys.catalog, queryFn: fetchCatalogItems })
}

export function useSaveCatalogItem() {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: createCatalogItem,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.catalog }),
    onError: (error) => report(notify, error, 'save that piece'),
  })
}

export function useDeleteCatalogItem() {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: removeCatalogItem,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.catalog }),
    onError: (error) => report(notify, error, 'remove that piece'),
  })
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: fetchSettings })
}

export function useCreateProject(): UseMutationResult<Project, Error, CreateProjectInput> {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.projects }),
    onError: (error) => report(notify, error, 'create that build'),
  })
}

export function useRenameProject() {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => patchProject(id, { name }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.projects }),
    onError: (error) => report(notify, error, 'rename that build'),
  })
}

export function useDuplicateProject() {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => duplicateProject(id, name),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.projects }),
    onError: (error) => report(notify, error, 'duplicate that build'),
  })
}

export function useDeleteProject() {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: removeProject,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.projects }),
    onError: (error) => report(notify, error, 'delete that build'),
  })
}

export function useUpdateSettings() {
  const client = useQueryClient()
  const notify = useNotify()
  return useMutation({
    mutationFn: (patch: UpdateSettingsInput) => patchSettings(patch),
    // Settings drive the rules engine and every displayed unit, so the cache is
    // written directly rather than invalidated — a refetch round trip would show
    // the old units for a beat after the user changed them.
    onSuccess: (settings: UserSettings) => {
      client.setQueryData(queryKeys.settings, settings)
    },
    onError: (error) => report(notify, error, 'save that setting'),
  })
}

/** Look up a van model from the cached preset library. */
export function useVanModel(id: string | null | undefined): VanModel | null {
  const { data } = useVanModels()
  if (!id || !data) return null
  return data.find((model) => model.id === id) ?? null
}

export type { ProjectSummary }

/** Shared shape for every failure path. */
function report(
  notify: (message: string, detail?: string) => void,
  error: unknown,
  action: string,
): void {
  const described = describeMutationError(error, action)
  notify(described.message, described.detail)
}
