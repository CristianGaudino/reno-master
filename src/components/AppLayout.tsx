import { NavLink, Outlet } from 'react-router'
import { cn } from '../lib/cn'

/** Shell for the non-editor pages. The editor takes the whole viewport itself. */
export function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface-raised px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">Van Build Planner</span>
        <nav className="flex gap-1">
          {[
            { to: '/projects', label: 'Builds' },
            { to: '/settings', label: 'Settings' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded px-2 py-1 text-sm transition-colors',
                  isActive ? 'bg-surface-sunken text-ink' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
