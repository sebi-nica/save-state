import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api/client'
import BacklogPicker from './BacklogPicker'

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
  errorMessage: (error) => error.message,
}))

const pick = (id, title, hours) => ({
  entry: { id, status: 'Backlog', game: { id: id * 10, title, cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg', release_date: '2020-01-01', ttb_normally: hours * 3600 } },
  matched_genres: ['RPG'],
})

function renderPicker() {
  render(
    <MemoryRouter>
      <BacklogPicker />
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('BacklogPicker', () => {
  it('shows picks with their length and re-picks with a length limit', async () => {
    api.get.mockResolvedValue({ data: { backlog_size: 4, results: [pick(1, 'Celeste', 21)], message: null } })
    renderPicker()

    expect(await screen.findByText('Celeste')).toBeInTheDocument()
    expect(screen.getByText('2020 · ~21h')).toBeInTheDocument()
    const cover = screen.getByRole('img', { name: 'Celeste cover' })
    expect(cover).toHaveAttribute('src', expect.stringContaining('/t_cover_small/'))
    expect(cover).toHaveAttribute('srcset', expect.stringContaining('/t_cover_small_2x/'))
    expect(api.get).toHaveBeenLastCalledWith('/recommendations/next/', { params: { count: 3, max_hours: undefined } })

    await userEvent.click(screen.getByRole('button', { name: 'Under 10h' }))
    expect(api.get).toHaveBeenLastCalledWith('/recommendations/next/', { params: { count: 3, max_hours: 10 } })
    expect(screen.getByRole('button', { name: 'Under 10h' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('moves a pick to Playing', async () => {
    api.get.mockResolvedValue({ data: { backlog_size: 2, results: [pick(1, 'Celeste', 21), pick(2, 'Hades', 22)], message: null } })
    api.patch.mockResolvedValue({ data: {} })
    renderPicker()

    const buttons = await screen.findAllByRole('button', { name: 'Start playing' })
    await userEvent.click(buttons[0])

    expect(api.patch).toHaveBeenCalledWith('/library/1/', { status: 'Playing' })
    expect(await screen.findByText(/Celeste moved to Playing/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Start playing' })).toHaveLength(1)
  })

  it('explains when nothing fits the length limit', async () => {
    api.get.mockResolvedValue({ data: { backlog_size: 3, results: [], message: 'No backlog games with a known length under 10 hours.' } })
    renderPicker()
    expect(await screen.findByText(/under 10 hours/)).toBeInTheDocument()
  })

  it('hides itself when the backlog is empty', async () => {
    api.get.mockResolvedValue({ data: { backlog_size: 0, results: [], message: 'Your backlog is empty.' } })
    renderPicker()
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled())
    await vi.waitFor(() => expect(screen.queryByText('What should I play next?')).toBeNull())
  })
})
