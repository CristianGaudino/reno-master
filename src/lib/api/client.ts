/**
 * The browser's entry to the API.
 *
 * Types are inferred from the Hono route definitions in `server/app.ts`, so a
 * handler that changes shape breaks every wrong call site at compile time. This
 * is the client-side counterpart to `lib/data.ts` and `lib/actions/` — those run
 * on the server and touch Postgres; everything here goes over HTTP.
 */

import { hc } from 'hono/client'
import type { AppType } from '../../../server/app'
import type {
  CreateCatalogItemInput,
  CreateProjectInput,
  Project,
  ProjectSummary,
  SyncRequest,
  SyncResponse,
  UpdateProjectInput,
  UpdateSettingsInput,
  UserCatalogItem,
  UserSettings,
  VanModel,
  VanObject,
} from '../definitions'
import { SYNC_REQUEST_TIMEOUT_MS } from '../config'

const client = hc<AppType>('/')

/** Thrown for any non-2xx response, carrying the status so callers can branch. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Van models
// ---------------------------------------------------------------------------

export async function fetchVanModels(): Promise<VanModel[]> {
  const response = await client.api['van-models'].$get()
  const body = await unwrap<{ models: VanModel[] }>(response)
  return body.models
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await client.api.projects.$get()
  const body = await unwrap<{ projects: ProjectSummary[] }>(response)
  return body.projects
}

export async function fetchProject(
  id: string,
): Promise<{ project: Project; objects: VanObject[] }> {
  const response = await client.api.projects[':id'].$get({ param: { id } })
  return unwrap<{ project: Project; objects: VanObject[] }>(response)
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const response = await client.api.projects.$post({ json: input })
  const body = await unwrap<{ project: Project }>(response)
  return body.project
}

export async function patchProject(
  id: string,
  patch: UpdateProjectInput,
): Promise<Project> {
  const response = await client.api.projects[':id'].$patch({ param: { id }, json: patch })
  const body = await unwrap<{ project: Project }>(response)
  return body.project
}

export async function removeProject(id: string): Promise<void> {
  const response = await client.api.projects[':id'].$delete({ param: { id } })
  await unwrap<{ ok: true }>(response)
}

export async function duplicateProject(id: string, name: string): Promise<Project> {
  const response = await client.api.projects[':id'].duplicate.$post({
    param: { id },
    json: { name },
  })
  const body = await unwrap<{ project: Project }>(response)
  return body.project
}

/**
 * Commit a delta.
 *
 * A 409 is an expected outcome rather than a failure — it means someone wrote to
 * this project in between, so it is returned as data for the caller to resolve
 * rather than thrown.
 */
export async function syncProject(
  id: string,
  request: SyncRequest,
): Promise<SyncResponse> {
  const response = await client.api.projects[':id'].sync.$post(
    { param: { id }, json: request },
    { init: { signal: AbortSignal.timeout(SYNC_REQUEST_TIMEOUT_MS) } },
  )

  if (response.status === 409) {
    return response.json() as Promise<SyncResponse>
  }

  return unwrap<SyncResponse>(response)
}

/**
 * Fire-and-forget flush used on `pagehide`.
 *
 * `sendBeacon` is the only thing browsers reliably allow once a page is going
 * away — a normal fetch is cancelled mid-flight. It cannot report success, so
 * the local copy is kept until a later sync confirms.
 */
export function beaconSync(id: string, request: SyncRequest): boolean {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false

  const blob = new Blob([JSON.stringify(request)], { type: 'application/json' })
  return navigator.sendBeacon(`/api/projects/${id}/sync`, blob)
}

// ---------------------------------------------------------------------------
// Personal catalog
// ---------------------------------------------------------------------------

export async function fetchCatalogItems(): Promise<UserCatalogItem[]> {
  const response = await client.api.catalog.$get()
  const body = await unwrap<{ items: UserCatalogItem[] }>(response)
  return body.items
}

export async function createCatalogItem(
  input: CreateCatalogItemInput,
): Promise<UserCatalogItem> {
  const response = await client.api.catalog.$post({ json: input })
  const body = await unwrap<{ item: UserCatalogItem }>(response)
  return body.item
}

export async function removeCatalogItem(id: string): Promise<void> {
  const response = await client.api.catalog[':id'].$delete({ param: { id } })
  await unwrap<{ ok: true }>(response)
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function fetchSettings(): Promise<UserSettings> {
  const response = await client.api.settings.$get()
  const body = await unwrap<{ settings: UserSettings }>(response)
  return body.settings
}

export async function patchSettings(patch: UpdateSettingsInput): Promise<UserSettings> {
  const response = await client.api.settings.$patch({ json: patch })
  const body = await unwrap<{ settings: UserSettings }>(response)
  return body.settings
}
