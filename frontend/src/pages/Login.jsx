import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Field, Input } from '../components/ui'

export function AuthCard({ title, children, footer }) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">{title}</h1>
      <div className="rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-800">{children}</div>
      <p className="mt-4 text-center text-sm text-slate-400">{footer}</p>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form.username, form.password)
      // GuestOnly redirects once the user is set.
    } catch (err) {
      setError(err.response?.status === 401 ? 'Incorrect username or password.' : errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="text-violet-400 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <Input autoComplete="username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Alert>{error}</Alert>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthCard>
  )
}
