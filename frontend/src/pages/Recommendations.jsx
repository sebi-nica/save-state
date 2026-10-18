import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { Alert, Button, Chip, Cover, EmptyState, PageLoader, year } from '../components/ui'

export default function Recommendations() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    api
      .get('/recommendations/')
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  async function addToBacklog(item) {
    setBusy(item.game.id)
    try {
      await api.post('/library/', { game_id: item.game.id, status: 'Backlog' })
      setData((d) => ({ ...d, results: d.results.filter((r) => r.game.id !== item.game.id) }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (!data && !error) return <PageLoader />

  return (
    <div>
      <h1 className="text-2xl font-bold">Recommended for you</h1>
      {data?.based_on?.genres.length > 0 && (
        <p className="mt-1 text-sm text-slate-400">
          Based on your favourite genres ({data.based_on.genres.join(', ')})
          {data.based_on.platforms.length > 0 && <> and platforms ({data.based_on.platforms.join(', ')})</>}.
        </p>
      )}

      <div className="mt-6 space-y-4">
        <Alert>{error}</Alert>
        {data && data.results.length === 0 && (
          <EmptyState title="No recommendations yet">
            {data.message}{' '}
            <Link to="/library" className="text-violet-400 hover:underline">
              Go to your library
            </Link>
          </EmptyState>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {data?.results.map((item) => (
          <div key={item.game.id} className="flex flex-col rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
            <Link to={`/games/${item.game.id}`} className="group">
              <Cover src={item.game.cover_url} title={item.game.title} className="transition group-hover:opacity-90" />
              <h3 className="mt-3 line-clamp-2 font-medium leading-snug group-hover:text-violet-300">{item.game.title}</h3>
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">{year(item.game.release_date) ?? 'TBA'}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.matched_genres.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>
            <div className="mt-auto pt-3">
              <Button size="sm" variant="secondary" className="w-full" loading={busy === item.game.id} onClick={() => addToBacklog(item)}>
                + Backlog
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
