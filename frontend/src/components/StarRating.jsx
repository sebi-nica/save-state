import { useState } from 'react'

function Star({ filled, className }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9z"
        className={filled ? 'fill-amber-400' : 'fill-slate-700'}
      />
    </svg>
  )
}

export default function StarRating({ value, onChange, size = 'md', disabled = false }) {
  const [hover, setHover] = useState(null)
  const dims = size === 'sm' ? 'h-4 w-4' : 'h-7 w-7'
  const shown = hover ?? value ?? 0

  if (!onChange) {
    if (!value) return null
    return (
      <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= value} className={dims} />
        ))}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? null : n)}
          className="rounded transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Star filled={n <= shown} className={dims} />
        </button>
      ))}
      {value && !disabled && (
        <button type="button" onClick={() => onChange(null)} className="ml-2 text-xs text-slate-400 hover:text-slate-200">
          Clear
        </button>
      )}
    </div>
  )
}
