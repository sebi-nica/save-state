import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import EntryEditor from '../components/EntryEditor'
import StarRating from '../components/StarRating'
import { Alert, Cover, EmptyState, PageLoader, Select, year } from '../components/ui'
import { RATEABLE, STATUSES } from '../constants'

const TABS = ['All', ...STATUSES]

function LibraryCard({ entry, onStatusChange, onEdit }) {
  const { game } = entry
  return (
    <div className="flex flex-col rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
      <Link to={`/games/${game.id}`} className="group">
        <Cover src={game.cover_url} title={game.title} className="transition group-hover:opacity-90" />
        <h3 className="mt-3 line-clamp-2 font-medium leading-snug group-hover:text-violet-300">{game.title}</h3>
      </Link>
      <p className="mt-0.5 text-xs text-slate-500">{year(game.release_date) ?? 'TBA'}</p>
      <div className="mt-2 min-h-5">
        {entry.review_visible && <StarRating value={entry.rating} size="sm" />}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3">
        <div className="flex-1">
          <Select value={entry.status} onChange={(e) => onStatusChange(entry, e.target.value)} aria-label={`Status of ${game.title}`}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <button
          onClick={() => onEdit(entry)}
          className="rounded-lg p-2 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-800 hover:text-white"
          aria-label={`Edit ${game.title}`}
          title={RATEABLE.includes(entry.status) ? 'Rate & review' : 'Edit'}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-8.8 8.8-3.6.8.8-3.6z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function Library() {
  const [entries, setEntries] = useState(null)
  const [tab, setTab] = useState('All')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/library/')
      .then((res) => setEntries(res.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const counts = useMemo(() => {
    const c = { All: entries?.length ?? 0 }
    STATUSES.forEach((s) => (c[s] = entries?.filter((e) => e.status === s).length ?? 0))
    return c
  }, [entries])

  const replace = (updated) => setEntries((list) => list.map((e) => (e.id === updated.id ? updated : e)))

  async function changeStatus(entry, status) {
    // Moving into Completed/Dropped: open the editor so the user can rate right away.
    if (RATEABLE.includes(status) && !RATEABLE.includes(entry.status)) {
      setEditing({ ...entry, status })
      return
    }
    try {
      replace((await api.patch(`/library/${entry.id}/`, { status })).data)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!entries && !error) return <PageLoader />
  const shown = (entries ?? []).filter((e) => tab === 'All' || e.status === tab)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My library</h1>
          <p className="text-sm text-slate-400">{counts.All} games tracked</p>
        </div>
        <Link to="/search" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500">
          + Add games
        </Link>
      </div>

      <div className="-mx-4 mb-6 overflow-x-auto px-4">
        <div className="flex gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white'
              }`}
            >
              {t} <span className="ml-1 opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      <Alert>{error}</Alert>

      {shown.length === 0 ? (
        <EmptyState title={tab === 'All' ? 'Your library is empty' : `Nothing in ${tab}`}>
          <Link to="/search" className="text-violet-400 hover:underline">
            Search for games
          </Link>{' '}
          to start tracking.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((entry) => (
            <LibraryCard key={entry.id} entry={entry} onStatusChange={changeStatus} onEdit={setEditing} />
          ))}
        </div>
      )}

      {editing && (
        <EntryEditor
          title={editing.game.title}
          entry={editing}
          onSaved={replace}
          onDeleted={(d) => setEntries((list) => list.filter((e) => e.id !== d.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
