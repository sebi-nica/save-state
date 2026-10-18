import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/AuthContext'
import { GuestOnly, RequireAdmin, RequireAuth } from './guards'

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))

function renderAt(path, auth) {
  useAuth.mockReturnValue(auth)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/library" element={<p>Library page</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/private" element={<p>Private page</p>} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<p>Admin page</p>} />
        </Route>
        <Route element={<GuestOnly />}>
          <Route path="/register" element={<p>Register page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const member = { username: 'a', is_staff: false }
const admin = { username: 'b', is_staff: true }

describe('route guards', () => {
  it('shows a loader while the session is being restored', () => {
    renderAt('/private', { user: null, loading: true })
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('RequireAuth sends guests to the login page', () => {
    renderAt('/private', { user: null, loading: false })
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('RequireAuth lets members through', () => {
    renderAt('/private', { user: member, loading: false })
    expect(screen.getByText('Private page')).toBeInTheDocument()
  })

  it('RequireAdmin sends non-staff to their library', () => {
    renderAt('/admin', { user: member, loading: false })
    expect(screen.getByText('Library page')).toBeInTheDocument()
  })

  it('RequireAdmin lets staff through', () => {
    renderAt('/admin', { user: admin, loading: false })
    expect(screen.getByText('Admin page')).toBeInTheDocument()
  })

  it('GuestOnly sends signed-in users to their library', () => {
    renderAt('/register', { user: member, loading: false })
    expect(screen.getByText('Library page')).toBeInTheDocument()
  })
})
