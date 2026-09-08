import { Link, useRouteError } from 'react-router'
import { Button } from './ui'

export function ErrorScreen() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-ink">That did not load</p>
      <p className="max-w-md text-sm text-ink-muted">{message}</p>
      <p className="max-w-md text-xs text-ink-faint">
        Any work you had open is still stored on this device and will reappear
        when the project opens again.
      </p>
      <Link to="/projects">
        <Button>Back to builds</Button>
      </Link>
    </div>
  )
}
