import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function NavItem({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`
      }
    >
      {children}
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  async function handleLogout() {
    close()
    await logout()
    navigate('/login')
  }

  const links = user ? (
    <>
      <NavItem to="/library" onClick={close}>Library</NavItem>
      <NavItem to="/search" onClick={close}>Search</NavItem>
      <NavItem to="/recommendations" onClick={close}>For you</NavItem>
      {user.is_staff && <NavItem to="/admin" onClick={close}>Admin</NavItem>}
    </>
  ) : null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span>SaveState</span>
          </Link>
          <nav className="hidden gap-1 md:flex">{links}</nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <NavItem to="/profile">{user.username}</NavItem>
                <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavItem to="/login">Log in</NavItem>
                <Link to="/register" className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium hover:bg-violet-500">
                  Sign up
                </Link>
              </>
            )}
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-slate-800 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-slate-800 px-4 py-3 md:hidden">
            {links}
            {user ? (
              <>
                <NavItem to="/profile" onClick={close}>Profile ({user.username})</NavItem>
                <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:text-white">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavItem to="/login" onClick={close}>Log in</NavItem>
                <NavItem to="/register" onClick={close}>Sign up</NavItem>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        Game data provided by{' '}
        <a href="https://www.igdb.com" target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
          IGDB.com
        </a>{' '}
        (Twitch).
      </footer>
    </div>
  )
}
