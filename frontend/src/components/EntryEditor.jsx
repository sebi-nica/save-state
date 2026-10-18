import { useRef, useState } from 'react'
import api, { errorMessage } from '../api/client'
import { RATEABLE, STATUSES, STATUS_STYLES } from '../constants'
import StarRating from './StarRating'
import { Alert, Button, Field, Modal, Spinner, TextArea } from './ui'

function StatusPicker({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STATUSES.map((s) => {
        const selected = value === s
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium ring-1 transition disabled:opacity-50 ${
              selected ? STATUS_STYLES[s] + ' ring-2' : 'bg-slate-950 text-slate-400 ring-slate-700 hover:text-white hover:ring-slate-500'
            }`}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Add a game to the library or edit an existing entry. Changes are saved when the window closes
 * (close button, Escape or clicking outside).
 * - `entry` set: edit mode. Closing PATCHes only if something changed. `initialStatus` pre-selects
 *   a different status (e.g. the Library opens the editor when a game is moved to Completed).
 * - otherwise `target` = { igdb_id } or { game_id }: add mode. Nothing is pre-selected; closing
 *   without picking a status adds nothing.
 */
export default function EntryEditor({ title, entry, target, initialStatus, onSaved, onDeleted, onClose }) {
  const [status, setStatus] = useState(initialStatus ?? entry?.status ?? null)
  const [rating, setRating] = useState(entry?.rating ?? null)
  const [review, setReview] = useState(entry?.review ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)

  const rateable = RATEABLE.includes(status)
  const hasHiddenReview = status && !rateable && (entry?.rating || entry?.review)

  function buildPayload() {
    if (!status) return null
    const payload = { status }
    // Ratings only travel with Completed/Dropped; otherwise the stored rating is kept but hidden.
    if (rateable) {
      payload.rating = rating
      payload.review = review.trim() || null
    }
    if (!entry) return payload
    const changed =
      status !== entry.status || (rateable && (payload.rating !== entry.rating || payload.review !== (entry.review || null)))
    return changed ? payload : null
  }

  async function close() {
    if (busy.current) return
    const payload = buildPayload()
    if (!payload) return onClose()
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const res = entry
        ? await api.patch(`/library/${entry.id}/`, payload)
        : await api.post('/library/', { ...target, ...payload })
      onSaved?.(res.data)
      onClose()
    } catch (err) {
      // Stay open so the change isn't lost silently.
      setError(errorMessage(err))
      setSaving(false)
      busy.current = false
    }
  }

  async function remove() {
    if (busy.current) return
    if (!window.confirm(`Remove "${title}" from your library? Your rating and review will be lost.`)) return
    busy.current = true
    setSaving(true)
    try {
      await api.delete(`/library/${entry.id}/`)
      onDeleted?.(entry)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
      busy.current = false
    }
  }

  let hint
  if (!status) hint = 'Pick a status to add this game. It is saved when you close this window.'
  else if (hasHiddenReview) hint = `Your rating and review are kept but hidden while this game is ${status}.`
  else if (!rateable) hint = 'You can rate and review a game once it is Completed or Dropped.'

  return (
    <Modal title={entry ? `Edit: ${title}` : `Add: ${title}`} onClose={close}>
      <div className="space-y-4">
        <StatusPicker value={status} onChange={setStatus} disabled={saving} />

        {rateable && (
          <>
            <Field label="Rating">
              <StarRating value={rating} onChange={setRating} disabled={saving} />
            </Field>
            <Field label="Review" hint="Reviews are public on the game's page.">
              <TextArea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                maxLength={5000}
                placeholder="What did you think?"
                disabled={saving}
              />
            </Field>
          </>
        )}

        {hint && <p className="text-sm text-slate-400">{hint}</p>}

        <Alert>{error}</Alert>

        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          {entry ? (
            <Button type="button" variant="danger" size="sm" onClick={remove} disabled={saving}>
              Remove from library
            </Button>
          ) : (
            <span />
          )}
          {saving ? (
            <span className="flex items-center gap-2 text-sm text-slate-400" role="status">
              <Spinner className="h-4 w-4" /> Saving…
            </span>
          ) : (
            status && <span className="text-xs text-slate-500">Saved when you close this window</span>
          )}
        </div>
      </div>
    </Modal>
  )
}
