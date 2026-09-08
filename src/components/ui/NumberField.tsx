import { useState } from 'react'
import type { Mm, UnitSystem } from '../../lib/definitions'
import { formatLength, lengthStep, lengthUnitLabel, parseLength } from '../../lib/units'
import { cn } from '../../lib/cn'

interface NumberFieldProps {
  label: string
  /** Canonical value in millimetres. */
  value: Mm
  onChange(value: Mm): void
  unitSystem: UnitSystem
  min?: Mm
  max?: Mm
  disabled?: boolean
  className?: string
}

/**
 * A dimension input.
 *
 * The field holds text, not a number, so a half-typed value like `6'` is not
 * clobbered mid-keystroke. It commits on blur or Enter, and reverts on Escape.
 *
 * Unparseable input is left alone and marked invalid rather than being coerced —
 * silently turning `6 ft` into 6mm in a tool whose selling point is accuracy
 * would be the worst possible failure.
 */
export function NumberField({
  label,
  value,
  onChange,
  unitSystem,
  min,
  max,
  disabled,
  className,
}: NumberFieldProps) {
  const [text, setText] = useState(() => formatLength(value, unitSystem, { bare: true }))
  const [editing, setEditing] = useState(false)
  const [invalid, setInvalid] = useState(false)

  // Re-sync when the value changes underneath — dragging an object updates the
  // same number this field is showing — but never while it is being typed in.
  //
  // Adjusted during render rather than in an effect: React applies this before
  // painting, so the field never flashes the stale value, and it avoids the
  // cascading re-render an effect would cause on every frame of a drag.
  const [lastExternal, setLastExternal] = useState({ value, unitSystem })
  if (!editing && (lastExternal.value !== value || lastExternal.unitSystem !== unitSystem)) {
    setLastExternal({ value, unitSystem })
    setText(formatLength(value, unitSystem, { bare: true }))
    setInvalid(false)
  }

  const commit = () => {
    setEditing(false)

    const parsed = parseLength(text, unitSystem)
    if (parsed === null) {
      setInvalid(true)
      return
    }

    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed))
    setInvalid(false)
    setText(formatLength(clamped, unitSystem, { bare: true }))
    onChange(clamped)
  }

  const nudge = (direction: 1 | -1) => {
    const step = lengthStep(unitSystem)
    const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + step * direction))
    onChange(next)
  }

  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="field-label">{label}</span>
      <span className="relative flex items-center">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value)
            setEditing(true)
            setInvalid(false)
          }}
          onFocus={() => setEditing(true)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              setEditing(false)
              setText(formatLength(value, unitSystem, { bare: true }))
              setInvalid(false)
              event.currentTarget.blur()
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              nudge(1)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              nudge(-1)
            }
          }}
          className={cn(
            'h-8 w-full rounded-md border bg-surface-raised pl-2 pr-9 text-sm',
            'disabled:opacity-50',
            invalid ? 'border-danger text-danger' : 'border-border',
          )}
        />
        <span className="pointer-events-none absolute right-2 text-xs text-ink-faint">
          {lengthUnitLabel(unitSystem)}
        </span>
      </span>
    </label>
  )
}
