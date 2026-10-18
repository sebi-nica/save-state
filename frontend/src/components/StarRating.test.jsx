import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StarRating from './StarRating'

describe('StarRating', () => {
  it('sets the clicked value', async () => {
    const onChange = vi.fn()
    render(<StarRating value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '3 stars' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('clears when the current value is clicked again', async () => {
    const onChange = vi.fn()
    render(<StarRating value={3} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: '3 stars' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: '3 stars' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders read-only stars, or nothing without a value', () => {
    const { rerender, container } = render(<StarRating value={4} />)
    expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    rerender(<StarRating value={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
