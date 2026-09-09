/**
 * Small shared primitives.
 *
 * Kept in one file because each is a handful of lines and they are always used
 * together; anything that grows past that gets its own module (see Button and
 * NumberField).
 */

import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CONFIDENCE_EXPLANATIONS, CONFIDENCE_LABELS } from '../../lib/constants'
import type { Confidence } from '../../lib/definitions'

export { Button } from './Button'
export { NumberField } from './NumberField'
export { Modal } from './Modal'

// ---------------------------------------------------------------------------

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('panel flex min-h-0 flex-col', className)}>
      {(title || actions) && (
        <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange(value: boolean): void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 py-1.5',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm leading-tight text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

export function TextInput({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      {label && <span className="field-label">{label}</span>}
      <input
        type="text"
        className="h-8 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
        {...props}
      />
    </label>
  )
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string
  value: T
  onChange(value: T): void
  options: Array<{ value: T; label: string }>
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      {label && <span className="field-label">{label}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-8 w-full rounded-md border border-border bg-surface-raised px-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange(value: T): void
  options: Array<{ value: T; label: string }>
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex rounded-md border border-border bg-surface-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-surface-raised text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Provenance badge.
 *
 * Spec section 3 requires that unverified dimensions are never presented as
 * fact, so this sits next to any figure that came from the preset library and
 * carries the explanation in its tooltip.
 */
export function ConfidenceBadge({
  confidence,
  note,
  className,
}: {
  confidence: Confidence
  note?: string | null
  className?: string
}) {
  const tone =
    confidence === 'verified'
      ? 'bg-[var(--color-good)]/12 text-[var(--color-good)]'
      : confidence === 'approximate'
        ? 'bg-warn-soft text-[oklch(0.45_0.12_70)]'
        : 'bg-surface-sunken text-ink-muted'

  return (
    <span
      title={`${CONFIDENCE_EXPLANATIONS[confidence]}${note ? `\n\n${note}` : ''}`}
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium',
        tone,
        className,
      )}
    >
      {CONFIDENCE_LABELS[confidence]}
    </span>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-muted">{children}</p>}
      {action}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
