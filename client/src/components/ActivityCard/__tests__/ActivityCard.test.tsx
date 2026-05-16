import { render, screen, fireEvent } from '@testing-library/react'
import ActivityCard from '../index'
import type { Activity } from '../../../types/activity'

const mockActivity: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  source: 'strava',
  name: 'Morning Run',
  date: '2026-05-16T08:00:00.000Z',
  distanceMeters: 8200,
  durationSeconds: 2535,
  avgHR: 158,
  maxHR: 178,
  hrStream: [],
  paceStream: [],
}

describe('ActivityCard', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(<ActivityCard activity={mockActivity} onClick={jest.fn()} />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders activity name', () => {
    render(<ActivityCard activity={mockActivity} onClick={jest.fn()} />)
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
  })

  it('renders distance and avg HR', () => {
    render(<ActivityCard activity={mockActivity} onClick={jest.fn()} />)
    expect(screen.getByText(/8\.20 km/)).toBeInTheDocument()
    expect(screen.getByText(/158/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    render(<ActivityCard activity={mockActivity} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick on Enter keydown', () => {
    const onClick = jest.fn()
    render(<ActivityCard activity={mockActivity} onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
