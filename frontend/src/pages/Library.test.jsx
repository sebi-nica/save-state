import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api/client'
import Library from './Library'

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  errorMessage: (error) => error.message,
}))

const game = (id, title, hours = null) => ({
  id, title, cover_url: '', release_date: '2020-01-01', genres: [], platforms: [], ttb_normally: hours && hours * 3600,
})
const ENTRIES = [
  { id: 1, status: 'Playing', rating: null, review: null, review_visible: false, game: game(10, 'Celeste', 21) },
  { id: 2, status: 'Completed', rating: 5, review: 'Great', review_visible: true, game: game(11, 'Hades', 22) },
  { id: 3, status: 'Completed', rating: 4, review: null, review_visible: true, game: game(12, 'Elden Ring', 60) },
]

async function renderLibrary() {
  api.get.mockResolvedValue({ data: ENTRIES })
  render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Celeste' })
}

beforeEach(() => vi.clearAllMocks())

describe('Library', () => {
  it('shows per-status counts and filters by tab', async () => {
    await renderLibrary()
    expect(screen.getByRole('tab', { name: 'All 3' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Completed 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Backlog 0' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Completed 2' }))
    expect(screen.queryByRole('heading', { name: 'Celeste' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Hades' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Elden Ring' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Backlog 0' }))
    expect(screen.getByText('Nothing in Backlog')).toBeInTheDocument()
  })

  it('patches the status directly for non-rateable moves', async () => {
    await renderLibrary()
    api.patch.mockResolvedValue({ data: { ...ENTRIES[0], status: 'Backlog' } })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status of Celeste' }), 'Backlog')

    expect(api.patch).toHaveBeenCalledWith('/library/1/', { status: 'Backlog' })
    expect(await screen.findByRole('tab', { name: 'Backlog 1' })).toBeInTheDocument()
  })

  it('opens the editor to rate when a game moves to Completed', async () => {
    await renderLibrary()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status of Celeste' }), 'Completed')

    const dialog = screen.getByRole('dialog', { name: 'Edit: Celeste' })
    expect(within(dialog).getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('sorts by shortest time to beat and by rating', async () => {
    await renderLibrary()
    const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(screen.getByText('2020 · ~21h')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort library' }), 'shortest')
    expect(titles()).toEqual(['Celeste', 'Hades', 'Elden Ring'])

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort library' }), 'rating')
    expect(titles()).toEqual(['Hades', 'Elden Ring', 'Celeste'])
  })
})
