import { use } from 'react'
import { NoticeContext, type NoticeContextValue } from '../components/ui/noticeContext'

/**
 * Report a failure to the user.
 *
 * Falls back to a no-op outside a provider, so a component can be rendered in
 * isolation without having to stand up the whole app shell around it.
 */
export function useNotify(): NoticeContextValue['notify'] {
  return use(NoticeContext)?.notify ?? noop
}

function noop() {}
