import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import EntryEditor from '../components/EntryEditor'
import { Alert, Button, Chip, Cover, EmptyState, Input, Spinner, StatusBadge, year } from '../components/ui'

export default function Search() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(null)
  const [opening, setOpening] = useState(null)
  const navigate = useNavigate()

  // Debounced live search; the term is mirrored in the URL so back/forward keeps results.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setError('')
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      setParams({ q: term }, { replace: true })
      try {
        const res = await api.get('/games/search/', { params: { q: term } })
        if (!cancelled) setResults(res.data.results)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, setParams])

  // Viewing details stores the game locally (spec: data is saved when a user selects a game).
  async function openGame(result) {
    if (result.id) return navigate(`/games/${result.id}`)
    setOpening(result.igdb_id)
    try {
      const res = await api.post('/games/import/', { igdb_id: result.igdb_id })
      navigate(`/games/${res.data.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setOpening(null)
    }
  }

  function markAdded(entry) {
    setResults((list) =>
      list.map((r) => (r.igdb_id === entry.game.igdb_id ? { ...r, id: entry.game.id, library_status: entry.status } : r)),
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Find games</h1>
      <div className="relative mb-6">
        <Input
          type="search"
          autoFocus
          placeholder="Search by title, e.g. Hollow Knight"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search games"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-400">
            <Spinner className="h-5 w-5" />
          </span>
        )}
      </div>

      <Alert>{error}</Alert>

      {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <EmptyState title="No games found">Try a different spelling or a shorter title.</EmptyState>
      )}

      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.igdb_id} className="flex gap-4 rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
            <button onClick={() => openGame(r)} className="w-16 shrink-0 sm:w-20" aria-label={`View ${r.title}`}>
              <Cover src={r.cover_url} title={r.title} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => openGame(r)} className="text-left font-medium hover:text-violet-300">
                  {r.title}
                </button>
                {r.release_date && <span className="text-sm text-slate-500">{year(r.release_date)}</span>}
                {opening === r.igdb_id && <Spinner className="h-4 w-4 text-violet-400" />}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.genres.slice(0, 3).map((g) => (
                  <Chip key={g.id}>{g.name}</Chip>
                ))}
              </div>
              <p className="mt-2 line-clamp-1 text-xs text-slate-500">{r.platforms.map((p) => p.name).join(' · ')}</p>
            </div>
            <div className="flex shrink-0 items-start">
              {r.library_status ? (
                <StatusBadge status={r.library_status} />
              ) : (
                <Button size="sm" onClick={() => setAdding(r)}>
                  Add
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {adding && (
        <EntryEditor
          title={adding.title}
          target={{ igdb_id: adding.igdb_id }}
          onSaved={markAdded}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}
