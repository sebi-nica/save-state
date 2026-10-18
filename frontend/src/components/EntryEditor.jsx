import { useState } from 'react'
import api, { errorMessage } from '../api/client'
import { RATEABLE, STATUSES } from '../constants'
import StarRating from './StarRating'
import { Alert, Button, Field, Modal, Select, TextArea } from './ui'

/**
 * Add a game to the library or edit an existing entry.
 * - `entry` set: edit mode (PATCH / DELETE).
 * - otherwise `target` = { igdb_id } or { game_id } to create a new entry.
 */
export default function EntryEditor({ title, entry, target, defaultStatus = 'Backlog', onSaved, onDeleted, onClose }) {
  const [status, setStatus] = useState(entry?.status ?? defaultStatus)
  const [rating, setRating] = useState(entry?.rating ?? null)
  const [review, setReview] = useState(entry?.review ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const rateable = RATEABLE.includes(status)
  const hasHiddenReview = !rateable && (entry?.rating || entry?.review)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { status }
    // Ratings only travel with Completed/Dropped; otherwise the stored rating is kept but hidden.
    if (rateable) {
      payload.rating = rating
      payload.review = review.trim() || null
    }
    try {
      const res = entry
        ? await api.patch(`/library/${entry.id}/`, payload)
        : await api.post('/library/', { ...target, ...payload })
      onSaved?.(res.data)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${title}" from your library? Your rating and review will be lost.`)) return
    setSaving(true)
    try {
      await api.delete(`/library/${entry.id}/`)
      onDeleted?.(entry)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={entry ? `Edit: ${title}` : `Add: ${title}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>

        {rateable ? (
          <>
            <Field label="Rating">
              <StarRating value={rating} onChange={setRating} />
            </Field>
            <Field label="Review" hint="Reviews are public on the game's page.">
              <TextArea value={review} onChange={(e) => setReview(e.target.value)} maxLength={5000} placeholder="What did you think?" />
            </Field>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            {hasHiddenReview
              ? `Your rating and review are kept but hidden while this game is ${status}.`
              : 'You can rate and review a game once it is Completed or Dropped.'}
          </p>
        )}

        <Alert>{error}</Alert>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {entry ? (
            <Button type="button" variant="danger" onClick={remove} disabled={saving}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {entry ? 'Save' : 'Add to library'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
