/**
 * Project list: create, open, rename, duplicate, delete.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  useCreateProject,
  useDeleteProject,
  useDuplicateProject,
  useProjects,
  useRenameProject,
  useVanModels,
} from '../lib/api/queries'
import { DEFAULT_CUSTOM_INTERIOR } from '../lib/config'
import { vanModelLabel } from '../lib/vans'
import { formatLength } from '../lib/units'
import { useSettings } from '../lib/api/queries'
import {
  Button,
  ConfidenceBadge,
  EmptyState,
  Panel,
  Select,
  Spinner,
  TextInput,
} from '../components/ui'

export function ProjectsPage() {
  const navigate = useNavigate()
  const projects = useProjects()
  const vanModels = useVanModels()
  const settings = useSettings()
  const createProject = useCreateProject()
  const renameProject = useRenameProject()
  const duplicateProject = useDuplicateProject()
  const deleteProject = useDeleteProject()

  const [name, setName] = useState('')
  const [vanModelId, setVanModelId] = useState<string>('custom')

  const unitSystem = settings.data?.unitSystem ?? 'metric'

  const create = async () => {
    const trimmed = name.trim() || 'Untitled build'
    const project = await createProject.mutateAsync({
      name: trimmed,
      vanModelId: vanModelId === 'custom' ? null : vanModelId,
      customInterior: vanModelId === 'custom' ? { ...DEFAULT_CUSTOM_INTERIOR } : null,
    })
    void navigate(`/projects/${project.id}`)
  }

  const selectedModel = vanModels.data?.find((model) => model.id === vanModelId)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <Panel title="New build" bodyClassName="p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextInput
            label="Name"
            placeholder="Weekender"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void create()
            }}
          />

          <Select
            label="Van"
            value={vanModelId}
            onChange={setVanModelId}
            options={[
              { value: 'custom', label: 'Custom dimensions' },
              ...(vanModels.data ?? []).map((model) => ({
                value: model.id,
                label: vanModelLabel(model),
              })),
            ]}
          />

          <Button variant="primary" onClick={() => void create()} disabled={createProject.isPending}>
            {createProject.isPending ? <Spinner /> : 'Create'}
          </Button>
        </div>

        {selectedModel ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-2 text-xs text-ink-muted">
            <span>
              {formatLength(selectedModel.interior.w, unitSystem)} wide ×{' '}
              {formatLength(selectedModel.interior.d, unitSystem)} long ×{' '}
              {formatLength(selectedModel.interior.h, unitSystem)} high
            </span>
            <ConfidenceBadge
              confidence={selectedModel.confidence}
              note={selectedModel.sourceNote}
            />
            <span className="basis-full text-ink-faint">
              These figures are not verified against a physical vehicle. Measure
              your own van and correct them in the project before you cut anything.
            </span>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Custom starts at {formatLength(DEFAULT_CUSTOM_INTERIOR.w, unitSystem)} ×{' '}
            {formatLength(DEFAULT_CUSTOM_INTERIOR.d, unitSystem)} ×{' '}
            {formatLength(DEFAULT_CUSTOM_INTERIOR.h, unitSystem)}, editable in the project.
          </p>
        )}
      </Panel>

      <Panel title="Your builds">
        {projects.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-muted">
            <Spinner /> Loading…
          </div>
        ) : (projects.data?.length ?? 0) === 0 ? (
          <EmptyState title="No builds yet">
            Create one above to start laying out a van.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {projects.data?.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-surface-sunken"
              >
                <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {project.name}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {project.vanLabel} · {project.objectCount} object
                    {project.objectCount === 1 ? '' : 's'} · updated{' '}
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </Link>

                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = window.prompt('Rename build', project.name)
                      if (next && next.trim()) {
                        renameProject.mutate({ id: project.id, name: next.trim() })
                      }
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      duplicateProject.mutate({
                        id: project.id,
                        name: `${project.name} copy`,
                      })
                    }
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete "${project.name}"? It will stop appearing here.`,
                        )
                      ) {
                        deleteProject.mutate(project.id)
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
