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

const status = () => screen.getByRole('combobox', { name: 'Status' })

beforeEach(() => vi.clearAllMocks())

describe('EntryEditor', () => {
  it('only offers rating and review for Completed or Dropped', async () => {
    setup({ target: { igdb_id: 5 } })
    expect(screen.queryByRole('radiogroup', { name: 'Rating' })).toBeNull()
    expect(screen.getByText(/once it is Completed or Dropped/)).toBeInTheDocument()

    await userEvent.selectOptions(status(), 'Dropped')
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Review/ })).toBeInTheDocument()
  })

  it('adds a rated game with the chosen fields', async () => {
    api.post.mockResolvedValue({ data: { id: 1 } })
    const { onSaved, onClose } = setup({ target: { igdb_id: 5 } })

    await userEvent.selectOptions(status(), 'Completed')
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Review/ }), '  Great run  ')
    await userEvent.click(screen.getByRole('button', { name: 'Add to library' }))

    expect(api.post).toHaveBeenCalledWith('/library/', { igdb_id: 5, status: 'Completed', rating: 4, review: 'Great run' })
    expect(onSaved).toHaveBeenCalledWith({ id: 1 })
    expect(onClose).toHaveBeenCalled()
  })

  it('omits rating and review when moving to a non-rateable status, and explains why', async () => {
    api.patch.mockResolvedValue({ data: { id: 9 } })
    setup({ entry: { id: 9, status: 'Completed', rating: 5, review: 'Loved it' } })

    await userEvent.selectOptions(status(), 'Playing')
    expect(screen.getByText(/kept but hidden while this game is Playing/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(api.patch).toHaveBeenCalledWith('/library/9/', { status: 'Playing' })
  })

  it('shows API errors and stays open', async () => {
    api.post.mockRejectedValue(new Error('This game is already in your library.'))
    const { onClose } = setup({ target: { game_id: 3 } })

    await userEvent.click(screen.getByRole('button', { name: 'Add to library' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already in your library')
    expect(onClose).not.toHaveBeenCalled()
  })
})
