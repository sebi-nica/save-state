import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { Alert, Button, Chip, Cover, Spinner, gameMeta } from './ui'

const LENGTHS = [
  { label: 'Any length', hours: null },
  { label: 'Under 10h', hours: 10 },
  { label: 'Under 25h', hours: 25 },
  { label: 'Under 50h', hours: 50 },
]

/** "What should I play next?" - weighted random picks from the user's own Backlog. */
export default function BacklogPicker() {
  const [maxHours, setMaxHours] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(null)

  const pick = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/recommendations/next/', { params: { count: 3, max_hours: maxHours ?? undefined } })
      setData(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [maxHours])

  useEffect(() => {
    pick()
  }, [pick])

  async function startPlaying(entry) {
    try {
      await api.patch(`/library/${entry.id}/`, { status: 'Playing' })
      setStarted(entry.game.title)
      setData((d) => ({
        ...d,
        backlog_size: d.backlog_size - 1,
        results: d.results.filter((r) => r.entry.id !== entry.id),
      }))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Nothing to pick from at all: keep the page about recommendations.
  if (data && data.backlog_size === 0 && !started) return null

  return (
    <section className="mb-10 rounded-2xl bg-gradient-to-br from-violet-950/60 to-slate-900 p-5 ring-1 ring-violet-900/50 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">What should I play next?</h2>
          <p className="mt-1 text-sm text-slate-400">
            Picked from your backlog{data ? ` (${data.backlog_size} games)` : ''}, favouring the genres you rate highest.
          </p>
        </div>
        <Button variant="secondary" onClick={pick} loading={loading}>
          Shuffle
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Maximum length">
        {LENGTHS.map(({ label, hours }) => (
          <button
            key={label}
            aria-pressed={maxHours === hours}
            onClick={() => setMaxHours(hours)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              maxHours === hours ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 ring-1 ring-slate-700 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <Alert>{error}</Alert>
        {started && (
          <Alert kind="success">
            {started} moved to Playing. Have fun!{' '}
            <Link to="/library" className="underline">
              Go to library
            </Link>
          </Alert>
        )}
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-8 text-violet-400">
          <Spinner />
        </div>
      ) : data?.results.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{data.message ?? 'No more games to pick from.'}</p>
      ) : (
        <ul className={`mt-4 grid gap-3 sm:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
          {data?.results.map(({ entry, matched_genres: matched }) => (
            <li key={entry.id} className="flex gap-3 rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-800">
              <Link to={`/games/${entry.game.id}`} className="w-16 shrink-0">
                <Cover src={entry.game.cover_url} title={entry.game.title} size="small" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/games/${entry.game.id}`} className="line-clamp-2 font-medium leading-snug hover:text-violet-300">
                  {entry.game.title}
                </Link>
                <p className="text-xs text-slate-500">{gameMeta(entry.game)}</p>
                {matched.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {matched.slice(0, 2).map((g) => (
                      <Chip key={g}>{g}</Chip>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-2">
                  <Button size="sm" onClick={() => startPlaying(entry)}>
                    Start playing
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
