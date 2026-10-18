import { useEffect } from 'react'
import { STATUS_STYLES } from '../constants'

const BUTTON_VARIANTS = {
  primary: 'bg-violet-600 text-white hover:bg-violet-500 focus-visible:outline-violet-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 ring-1 ring-slate-700 focus-visible:outline-slate-400',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500 focus-visible:outline-rose-400',
  ghost: 'text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-slate-400',
}

export function Button({ variant = 'primary', size = 'md', className = '', loading = false, children, ...props }) {
  const sizes = { sm: 'px-2.5 py-1 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const INPUT_CLASS =
  'w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500'

export function Input(props) {
  return <input className={INPUT_CLASS} {...props} />
}

export function TextArea(props) {
  return <textarea className={`${INPUT_CLASS} min-h-28 resize-y`} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className={INPUT_CLASS} {...props}>
      {children}
    </select>
  )
}

export function Spinner({ className = 'h-6 w-6' }) {
  return (
    <svg className={`animate-spin text-current ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-20 text-violet-400" role="status" aria-label="Loading">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null
  const styles = {
    error: 'bg-rose-500/10 text-rose-200 ring-rose-500/30',
    success: 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/30',
    info: 'bg-sky-500/10 text-sky-200 ring-sky-500/30',
  }
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ring-1 ${styles[kind]}`}>
      {children}
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 px-6 py-14 text-center">
      <p className="font-medium text-slate-200">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-400">{children}</div>}
    </div>
  )
}

export function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}

export function Chip({ children }) {
  return <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{children}</span>
}

export function Cover({ src, title, className = '' }) {
  return src ? (
    <img src={src} alt={`${title} cover`} loading="lazy" className={`aspect-[3/4] w-full rounded-lg bg-slate-800 object-cover ${className}`} />
  ) : (
    <div className={`flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-slate-800 p-2 text-center text-xs text-slate-500 ${className}`}>
      {title}
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function year(dateString) {
  return dateString ? dateString.slice(0, 4) : null
}
