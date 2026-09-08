import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Leading glyph or icon. Kept separate so spacing stays consistent. */
  icon?: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95',
  secondary:
    'bg-surface-raised text-ink border border-border hover:bg-surface-sunken active:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
        'transition-[background-color,filter] duration-100',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
