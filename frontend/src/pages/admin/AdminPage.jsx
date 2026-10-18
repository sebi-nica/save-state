import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import StarRating from '../../components/StarRating'
import { Alert, Button, Input, PageLoader, StatusBadge, igdbImage } from '../../components/ui'

const TABS = { users: 'Users', games: 'Games', reviews: 'Reviews' }

/** Paginated, searchable admin list backed by /api/admin/<resource>/. */
function useAdminList(resource) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const reload = useCallback(() => {
    api
      .get(`/admin/${resource}/`, { params: { page, search: term || undefined } })
      .then((res) => {
        setData(res.data)
        setError('')
      })
      .catch((err) => setError(errorMessage(err)))
  }, [resource, page, term])

  useEffect(reload, [reload])

  async function run(request, onDone = reload) {
    try {
      await request()
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return { data, error, page, setPage, search, setSearch, reload, run }
}

function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">{children}</tbody>
      </table>
    </div>
  )
}

function Toolbar({ list, placeholder }) {
  return (
    <div className="mb-4 max-w-sm">
      <Input type="search" placeholder={placeholder} value={list.search} onChange={(e) => list.setSearch(e.target.value)} aria-label={placeholder} />
    </div>
  )
}

function Pager({ list }) {
  const { data, page, setPage } = list
  if (!data || (!data.next && !data.previous)) return null
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-400">
      <Button size="sm" variant="secondary" disabled={!data.previous} onClick={() => setPage(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} of {Math.max(1, Math.ceil(data.count / 20))}
      </span>
      <Button size="sm" variant="secondary" disabled={!data.next} onClick={() => setPage(page + 1)}>
        Next
      </Button>
    </div>
  )
}

function UsersTab() {
  const { user: me } = useAuth()
  const list = useAdminList('users')
  const patch = (u, fields) => list.run(() => api.patch(`/admin/users/${u.id}/`, fields))
  const remove = (u) =>
    window.confirm(`Delete user "${u.username}" and their whole library?`) && list.run(() => api.delete(`/admin/users/${u.id}/`))

  return (
    <>
      <Toolbar list={list} placeholder="Search username or email" />
      <Alert>{list.error}</Alert>
      {!list.data ? (
        <PageLoader />
      ) : (
        <Table headers={['User', 'Joined', 'Games', 'Active', 'Admin', '']}>
          {list.data.results.map((u) => {
            const locked = u.id === me.id || (u.is_superuser && !me.is_superuser)
            return (
              <tr key={u.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {u.username} {u.is_superuser && <span className="text-xs text-amber-400">superuser</span>}
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-400">{new Date(u.date_joined).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-400">{u.library_count}</td>
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={u.is_active} disabled={locked} onChange={(e) => patch(u, { is_active: e.target.checked })} aria-label={`${u.username} active`} />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={u.is_staff} disabled={locked} onChange={(e) => patch(u, { is_staff: e.target.checked })} aria-label={`${u.username} admin`} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="danger" disabled={locked} onClick={() => remove(u)}>
                    Delete
                  </Button>
                </td>
              </tr>
            )
          })}
        </Table>
      )}
      <Pager list={list} />
    </>
  )
}

function GamesTab() {
  const list = useAdminList('games')
  const [syncing, setSyncing] = useState(null)

  async function resync(g) {
    setSyncing(g.id)
    await list.run(() => api.post(`/admin/games/${g.id}/resync/`))
    setSyncing(null)
  }
  const remove = (g) =>
    window.confirm(`Delete "${g.title}"? It will also be removed from ${g.entry_count} user librar${g.entry_count === 1 ? 'y' : 'ies'}.`) &&
    list.run(() => api.delete(`/admin/games/${g.id}/`))

  return (
    <>
      <Toolbar list={list} placeholder="Search titles" />
      <Alert>{list.error}</Alert>
      {!list.data ? (
        <PageLoader />
      ) : (
        <Table headers={['Game', 'IGDB id', 'In libraries', 'Added', '']}>
          {list.data.results.map((g) => (
            <tr key={g.id} className="hover:bg-slate-900/60">
              <td className="px-4 py-3">
                <Link to={`/games/${g.id}`} className="flex items-center gap-3 hover:text-violet-300">
                  {g.cover_url ? <img src={igdbImage(g.cover_url, 'cover_small')} alt="" className="h-12 w-9 rounded object-cover" /> : <div className="h-12 w-9 rounded bg-slate-800" />}
                  <span className="font-medium">{g.title}</span>
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-400">{g.igdb_id}</td>
              <td className="px-4 py-3 text-slate-400">{g.entry_count}</td>
              <td className="px-4 py-3 text-slate-400">{new Date(g.created_at).toLocaleDateString()}</td>
              <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                <Button size="sm" variant="secondary" loading={syncing === g.id} onClick={() => resync(g)}>
                  Re-sync
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(g)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pager list={list} />
    </>
  )
}

function ReviewsTab() {
  const list = useAdminList('reviews')
  const remove = (r) =>
    window.confirm(`Remove ${r.username}'s rating and review of "${r.game_title}"?`) && list.run(() => api.delete(`/admin/reviews/${r.id}/`))

  return (
    <>
      <Toolbar list={list} placeholder="Search user, game or text" />
      <Alert>{list.error}</Alert>
      {!list.data ? (
        <PageLoader />
      ) : (
        <Table headers={['User', 'Game', 'Rating', 'Review', '']}>
          {list.data.results.map((r) => (
            <tr key={r.id} className="align-top hover:bg-slate-900/60">
              <td className="px-4 py-3 font-medium">{r.username}</td>
              <td className="px-4 py-3">
                <Link to={`/games/${r.game_id}`} className="hover:text-violet-300">
                  {r.game_title}
                </Link>
                <div className="mt-1">
                  <StatusBadge status={r.status} />
                </div>
              </td>
              <td className="px-4 py-3">
                <StarRating value={r.rating} size="sm" />
              </td>
              <td className="max-w-md px-4 py-3 text-slate-300">
                <p className="line-clamp-3 whitespace-pre-line">{r.review || <span className="text-slate-500">-</span>}</p>
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="danger" onClick={() => remove(r)}>
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pager list={list} />
    </>
  )
}

export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'users'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin</h1>
      <div className="mb-6 flex gap-2" role="tablist">
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParams({ tab: key })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === key ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'games' && <GamesTab />}
      {tab === 'reviews' && <ReviewsTab />}
    </div>
  )
}
