import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import EntryEditor from '../components/EntryEditor'
import StarRating from '../components/StarRating'
import { Alert, Button, Chip, Cover, EmptyState, PageLoader, StatusBadge, formatHours } from '../components/ui'

export default function GameDetail() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const load = () =>
    api
      .get(`/games/${id}/`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.status === 404 ? 'Game not found.' : errorMessage(err)))

  // Wait for the session check so the page is fetched once, with the user's own entry.
  useEffect(() => {
    if (authLoading) return
    setData(null)
    setError('')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, authLoading])

  if (error) return <Alert>{error}</Alert>
  if (!data) return <PageLoader />
  const { game, my_entry: mine } = data

  return (
    <div>
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="mx-auto w-48 md:w-full">
          <Cover src={game.cover_url} title={game.title} size="hero" className="shadow-2xl shadow-violet-950/50" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{game.title}</h1>
          <p className="mt-1 text-slate-400">
            {game.release_date
              ? new Date(game.release_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
              : 'Release date TBA'}
          </p>

          <div className="mt-4 flex items-center gap-3">
            {data.rating_count > 0 ? (
              <>
                <StarRating value={Math.round(data.rating_average)} />
                <span className="text-sm text-slate-400">
                  {data.rating_average.toFixed(1)} from {data.rating_count} rating{data.rating_count > 1 ? 's' : ''}
                </span>
              </>
            ) : (
              <span className="text-sm text-slate-500">No ratings yet</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {user ? (
              mine ? (
                <>
                  <StatusBadge status={mine.status} />
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    Edit in library
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)}>Add to library</Button>
              )
            ) : (
              <Link to="/login" className="text-sm text-violet-400 hover:underline">
                Log in to track this game
              </Link>
            )}
          </div>

          {game.ttb_normally && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Time to beat</h2>
              <dl className="flex flex-wrap gap-2 text-sm">
                {[
                  ['Rushed', game.ttb_hastily],
                  ['Main story', game.ttb_normally],
                  ['Completionist', game.ttb_completely],
                ]
                  .filter(([, seconds]) => seconds)
                  .map(([label, seconds]) => (
                    <div key={label} className="rounded-lg bg-slate-900 px-3 py-1.5 ring-1 ring-slate-800">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="font-medium">{formatHours(seconds)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
          {game.genres.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Genres</h2>
              <div className="flex flex-wrap gap-1.5">
                {game.genres.map((g) => (
                  <Chip key={g.id}>{g.name}</Chip>
                ))}
              </div>
            </div>
          )}
          {game.platforms.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Platforms</h2>
              <div className="flex flex-wrap gap-1.5">
                {game.platforms.map((p) => (
                  <Chip key={p.id}>{p.name}</Chip>
                ))}
              </div>
            </div>
          )}
          {game.summary && <p className="mt-6 max-w-prose leading-relaxed text-slate-300">{game.summary}</p>}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Reviews</h2>
        {data.reviews.length === 0 ? (
          <EmptyState title="No reviews yet">Play this game and be the first to review it.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.reviews.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{r.username}</span>
                  <StarRating value={r.rating} size="sm" />
                  <StatusBadge status={r.status} />
                  <span className="ml-auto text-xs text-slate-500">{new Date(r.updated_at).toLocaleDateString()}</span>
                </div>
                {r.review && <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{r.review}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <EntryEditor
          title={game.title}
          entry={mine}
          target={{ game_id: game.id }}
          onSaved={load}
          onDeleted={load}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
