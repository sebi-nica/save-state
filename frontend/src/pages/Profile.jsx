import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errorMessage, setAccessToken } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Field, Input } from '../components/ui'

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-800">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function useForm(initial) {
  const [values, setValues] = useState(initial)
  const [status, setStatus] = useState({ busy: false, error: '', success: '' })
  const bind = (key) => ({ value: values[key], onChange: (e) => setValues({ ...values, [key]: e.target.value }) })
  return { values, setValues, status, setStatus, bind }
}

function AccountDetails() {
  const { user, setUser } = useAuth()
  const f = useForm({ username: user.username, email: user.email })

  async function submit(e) {
    e.preventDefault()
    f.setStatus({ busy: true, error: '', success: '' })
    try {
      const res = await api.patch('/auth/me/', f.values)
      setUser({ ...user, ...res.data })
      f.setStatus({ busy: false, error: '', success: 'Profile updated.' })
    } catch (err) {
      f.setStatus({ busy: false, error: errorMessage(err), success: '' })
    }
  }

  return (
    <Section title="Account details">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <Input required autoComplete="username" {...f.bind('username')} />
        </Field>
        <Field label="Email">
          <Input type="email" required autoComplete="email" {...f.bind('email')} />
        </Field>
        <Alert>{f.status.error}</Alert>
        <Alert kind="success">{f.status.success}</Alert>
        <Button type="submit" loading={f.status.busy}>
          Save changes
        </Button>
      </form>
    </Section>
  )
}

function ChangePassword() {
  const { startSession } = useAuth()
  const f = useForm({ current_password: '', new_password: '', confirm: '' })

  async function submit(e) {
    e.preventDefault()
    if (f.values.new_password !== f.values.confirm) {
      f.setStatus({ busy: false, error: 'New passwords do not match.', success: '' })
      return
    }
    f.setStatus({ busy: true, error: '', success: '' })
    try {
      const res = await api.post('/auth/me/password/', {
        current_password: f.values.current_password,
        new_password: f.values.new_password,
      })
      startSession(res.data)
      f.setValues({ current_password: '', new_password: '', confirm: '' })
      f.setStatus({ busy: false, error: '', success: 'Password changed.' })
    } catch (err) {
      f.setStatus({ busy: false, error: errorMessage(err), success: '' })
    }
  }

  return (
    <Section title="Change password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password">
          <Input type="password" required autoComplete="current-password" {...f.bind('current_password')} />
        </Field>
        <Field label="New password">
          <Input type="password" required minLength={8} autoComplete="new-password" {...f.bind('new_password')} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" required autoComplete="new-password" {...f.bind('confirm')} />
        </Field>
        <Alert>{f.status.error}</Alert>
        <Alert kind="success">{f.status.success}</Alert>
        <Button type="submit" loading={f.status.busy}>
          Update password
        </Button>
      </form>
    </Section>
  )
}

function DeleteAccount() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const f = useForm({ password: '' })

  async function submit(e) {
    e.preventDefault()
    if (!window.confirm('Delete your account and your whole library? This cannot be undone.')) return
    f.setStatus({ busy: true, error: '', success: '' })
    try {
      await api.delete('/auth/me/', { data: { password: f.values.password } })
      setAccessToken(null)
      setUser(null)
      navigate('/')
    } catch (err) {
      f.setStatus({ busy: false, error: errorMessage(err), success: '' })
    }
  }

  return (
    <Section title="Delete account" description="Permanently removes your account, library, ratings and reviews.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Confirm with your password">
          <Input type="password" required autoComplete="current-password" {...f.bind('password')} />
        </Field>
        <Alert>{f.status.error}</Alert>
        <Button type="submit" variant="danger" loading={f.status.busy}>
          Delete my account
        </Button>
      </form>
    </Section>
  )
}

export default function Profile() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <AccountDetails />
      <ChangePassword />
      <DeleteAccount />
    </div>
  )
}
