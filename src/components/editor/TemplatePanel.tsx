/**
 * Template picker.
 *
 * Loading a template replaces the current layout, so it asks first once there is
 * anything to lose. Spec section 5: templates fork — what lands in the project
 * is a copy with no link back, and everything in it is ordinary editable
 * furniture from that moment on.
 */

import { useState } from 'react'
import { TEMPLATES, type Template } from '../../lib/templates'
import { Button, Panel } from '../ui'
import { useEditorStore } from '../../store/editorStore'

export function TemplatePanel({ className }: { className?: string }) {
  const applyTemplate = useEditorStore((state) => state.applyTemplate)
  const objectCount = useEditorStore((state) => state.objects.length)
  const [confirming, setConfirming] = useState<Template | null>(null)

  const load = (template: Template) => {
    if (objectCount > 0) {
      setConfirming(template)
      return
    }
    applyTemplate(template)
  }

  return (
    <Panel title="Templates" className={className}>
      {confirming ? (
        <div className="space-y-3 p-3">
          <p className="text-sm text-ink">
            Load <strong>{confirming.name}</strong>?
          </p>
          <p className="text-xs leading-snug text-ink-muted">
            This replaces the {objectCount} object{objectCount === 1 ? '' : 's'} already
            in the van. You can undo it straight afterwards.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                applyTemplate(confirming)
                setConfirming(null)
              }}
            >
              Replace layout
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => load(template)}
                className="w-full px-3 py-2.5 text-left hover:bg-surface-sunken"
              >
                <span className="block text-sm leading-tight font-medium text-ink">
                  {template.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  {template.suitedTo}
                </span>
                <span className="mt-1 block text-xs leading-snug text-ink-muted">
                  {template.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border px-3 py-2 text-[0.6875rem] leading-snug text-ink-faint">
        Templates are starting points fitted to your van, not finished builds —
        the checks will still have opinions about them.
      </p>
    </Panel>
  )
}
