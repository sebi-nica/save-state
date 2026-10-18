import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-bold text-violet-400">404</p>
      <p className="mt-3 text-slate-400">This level doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block text-violet-400 hover:underline">
        Back to start
      </Link>
    </div>
  )
}
