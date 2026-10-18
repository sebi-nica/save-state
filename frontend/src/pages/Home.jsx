import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { PageLoader } from '../components/ui'

const FEATURES = [
  ['Track everything', 'Sort your games into Playing, Backlog, Completed and Dropped.'],
  ['Rate & review', 'Give finished games 1-5 stars and share what you thought.'],
  ['Discover', 'Get suggestions based on the genres and platforms you rate highest.'],
]

export default function Home() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to="/library" replace />

  return (
    <div className="py-10 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Beat the <span className="text-violet-400">backlog</span>.
        </h1>
        <p className="mt-5 text-lg text-slate-400">
          SaveState keeps your game library organized and tells you what to play next.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="rounded-lg bg-violet-600 px-5 py-2.5 font-medium hover:bg-violet-500">
            Create an account
          </Link>
          <Link to="/login" className="rounded-lg px-5 py-2.5 font-medium text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800">
            Log in
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
