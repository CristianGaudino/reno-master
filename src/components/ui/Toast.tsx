/**
 * Failure notices.
 *
 * Every mutation in the app used to fail silently: create a project offline and
 * the navigation simply did not happen, toggle a setting and it reverted with no
 * explanation. Silence is the worst possible response to a failed write, because
 * the user's mental model is now wrong and nothing told them.
 *
 * Deliberately only for failures. Success is already visible — the project
 * opens, the toggle stays put — and a stream of "saved!" confirmations trains
 * people to ignore the very place errors appear.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { NoticeContext, type Notice } from './noticeContext'
import { cn } from '../../lib/cn'

/** How long a notice stays before fading out. */
const NOTICE_TTL_MS = 8000

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])

  const notify = useCallback((message: string, detail?: string) => {
    const id = Date.now() + Math.random()
    setNotices((current) => [...current, { id, message, ...(detail ? { detail } : {}) }])
    setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id))
    }, NOTICE_TTL_MS)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NoticeContext value={value}>
      {children}

      {notices.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        >
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={cn(
                'pointer-events-auto w-full max-w-md rounded-lg border border-danger',
                'bg-danger-soft px-3 py-2 shadow-lg',
              )}
            >
              <p className="text-sm font-medium text-ink">{notice.message}</p>
              {notice.detail && (
                <p className="mt-0.5 text-xs leading-snug text-ink-muted">{notice.detail}</p>
              )}
              <button
                type="button"
                onClick={() =>
                  setNotices((current) => current.filter((item) => item.id !== notice.id))
                }
                className="mt-1 text-xs text-ink-muted underline hover:text-ink"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </NoticeContext>
  )
}
