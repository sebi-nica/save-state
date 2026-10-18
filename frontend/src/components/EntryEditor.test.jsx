import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api/client'
import EntryEditor from './EntryEditor'

vi.mock('../api/client', () => ({
  default: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  errorMessage: (error) => error.message,
}))

function setup(props = {}) {
  const handlers = { onSaved: vi.fn(), onClose: vi.fn(), onDeleted: vi.fn() }
  render(<EntryEditor title="Hades" {...handlers} {...props} />)
  return handlers
}

const statusButton = (name) => screen.getByRole('radio', { name })
const closeWindow = () => userEvent.click(screen.getByRole('button', { name: 'Close' }))

beforeEach(() => vi.clearAllMocks())

describe('EntryEditor', () => {
  it('shows every status as a button, with nothing pre-selected when adding', () => {
    setup({ target: { igdb_id: 5 } })
    for (const s of ['Playing', 'Backlog', 'Completed', 'Dropped']) {
      expect(statusButton(s)).toHaveAttribute('aria-checked', 'false')
    }
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Add to library|Save|Cancel/ })).toBeNull()
  })

  it('only offers rating and review for Completed or Dropped', async () => {
    setup({ target: { igdb_id: 5 } })
    await userEvent.click(statusButton('Backlog'))
    expect(screen.queryByRole('radiogroup', { name: 'Rating' })).toBeNull()
    expect(screen.getByText(/once it is Completed or Dropped/)).toBeInTheDocument()

    await userEvent.click(statusButton('Dropped'))
    expect(statusButton('Dropped')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('adds the game with the chosen fields when the window closes', async () => {
    api.post.mockResolvedValue({ data: { id: 1 } })
    const { onSaved, onClose } = setup({ target: { igdb_id: 5 } })

    await userEvent.click(statusButton('Completed'))
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    await userEvent.type(screen.getByRole('textbox'), '  Great run  ')
    expect(api.post).not.toHaveBeenCalled()
    await closeWindow()

    expect(api.post).toHaveBeenCalledWith('/library/', { igdb_id: 5, status: 'Completed', rating: 4, review: 'Great run' })
    expect(onSaved).toHaveBeenCalledWith({ id: 1 })
    expect(onClose).toHaveBeenCalled()
  })

  it('also saves when closed with Escape', async () => {
    api.post.mockResolvedValue({ data: { id: 2 } })
    setup({ target: { game_id: 3 } })
    await userEvent.click(statusButton('Playing'))
    await userEvent.keyboard('{Escape}')
    expect(api.post).toHaveBeenCalledWith('/library/', { game_id: 3, status: 'Playing' })
  })

  it('adds nothing when closed without choosing a status', async () => {
    const { onClose } = setup({ target: { igdb_id: 5 } })
    await closeWindow()
    expect(api.post).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('omits rating and review when moving to a non-rateable status, and explains why', async () => {
    api.patch.mockResolvedValue({ data: { id: 9 } })
    setup({ entry: { id: 9, status: 'Completed', rating: 5, review: 'Loved it' } })

    expect(statusButton('Completed')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(statusButton('Playing'))
    expect(screen.getByText(/kept but hidden while this game is Playing/)).toBeInTheDocument()
    await closeWindow()

    expect(api.patch).toHaveBeenCalledWith('/library/9/', { status: 'Playing' })
  })

  it('does not save an unchanged entry', async () => {
    const { onClose } = setup({ entry: { id: 9, status: 'Completed', rating: 5, review: 'Loved it' } })
    await closeWindow()
    expect(api.patch).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('saves a pre-selected initialStatus even if nothing else changes', async () => {
    api.patch.mockResolvedValue({ data: { id: 9 } })
    setup({ entry: { id: 9, status: 'Playing', rating: null, review: null }, initialStatus: 'Completed' })
    await closeWindow()
    expect(api.patch).toHaveBeenCalledWith('/library/9/', { status: 'Completed', rating: null, review: null })
  })

  it('stays open and shows the error when saving fails', async () => {
    api.post.mockRejectedValue(new Error('This game is already in your library.'))
    const { onClose } = setup({ target: { game_id: 3 } })

    await userEvent.click(statusButton('Backlog'))
    await closeWindow()

    expect(await screen.findByRole('alert')).toHaveTextContent('already in your library')
    expect(onClose).not.toHaveBeenCalled()
  })
})
