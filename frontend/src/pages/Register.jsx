import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Field, Input } from '../components/ui'
import { AuthCard } from './Login'

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await register({ username: form.username, email: form.email, password: form.password })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have one?{' '}
          <Link to="/login" className="text-violet-400 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <Input autoComplete="username" required maxLength={150} value={form.username} onChange={set('username')} />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters, not too common or all numbers.">
          <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password">
          <Input type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </Field>
        <Alert>{error}</Alert>
        <Button type="submit" className="w-full" loading={busy}>
          Sign up
        </Button>
      </form>
    </AuthCard>
  )
}
