import { useEffect, useState } from 'react'
import { onServerWaking } from '../api/client'
import { Spinner } from './ui'

/** Shown while any API request is unusually slow or being retried (e.g. Render cold start). */
export default function ServerStatusBanner() {
  const [waking, setWaking] = useState(false)
  useEffect(() => onServerWaking(setWaking), [])
  if (!waking) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
      <Spinner className="h-4 w-4" />
      Waking up the server… the first request after a quiet period can take up to a minute.
    </div>
  )
}
