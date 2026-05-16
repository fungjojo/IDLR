import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ActivityDetail from '../index'
import type { Activity } from '../../../types/activity'

const mockDispatch = jest.fn().mockReturnValue(Promise.resolve({ payload: undefined }))
const mockNavigate = jest.fn()

jest.mock('../../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'act-1' }),
  useNavigate: () => mockNavigate,
}))

jest.mock('../../../store/activitiesSlice', () => ({
  fetchActivityThunk: jest.fn((id: string) => ({
    type: 'activities/fetchActivity/pending',
    payload: id,
  })),
  deleteActivityThunk: jest.fn((id: string) => ({
    type: 'activities/deleteActivity/fulfilled',
    payload: id,
  })),
}))

jest.mock('../../../components/HRChart', () => ({
  __esModule: true,
  default: () => <div data-testid="hr-chart" />,
}))

import { useAppSelector } from '../../../store/hooks'
const mockUseAppSelector = useAppSelector as jest.Mock

const MOCK_ACTIVITY: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  source: 'strava',
  name: 'Morning Run',
  date: '2026-05-16T08:00:00.000Z',
  distanceMeters: 8200,
  durationSeconds: 2535,
  avgHR: 158,
  maxHR: 178,
  hrStream: [140, 145, 150, 155, 160],
  paceStream: [309, 310, 312],
  cadenceAvg: 176,
  elevationGainMeters: 42,
}

function renderScreen(stateOverrides = {}) {
  mockUseAppSelector.mockReturnValue({
    selected: null,
    loading: false,
    error: null,
    ...stateOverrides,
  })
  return render(
    <MemoryRouter>
      <ActivityDetail />
    </MemoryRouter>,
  )
}

describe('ActivityDetail screen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('matches snapshot', () => {
    const { asFragment } = renderScreen({ selected: MOCK_ACTIVITY })
    expect(asFragment()).toMatchSnapshot()
  })

  it('dispatches fetchActivityThunk with id on mount', () => {
    renderScreen()
    const { fetchActivityThunk } = jest.requireMock('../../../store/activitiesSlice')
    expect(fetchActivityThunk).toHaveBeenCalledWith('act-1')
    expect(mockDispatch).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    renderScreen({ loading: true })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state', () => {
    renderScreen({ error: 'Not found' })
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })

  it('renders activity name and stats', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
    expect(screen.getByText('158 bpm')).toBeInTheDocument()
    expect(screen.getByText('178 bpm')).toBeInTheDocument()
  })

  it('renders HR chart when hrStream is non-empty', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    expect(screen.getByTestId('hr-chart')).toBeInTheDocument()
  })

  it('renders cadence and elevation pills', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    expect(screen.getByText(/176 spm/)).toBeInTheDocument()
    expect(screen.getByText(/42 m/)).toBeInTheDocument()
  })

  it('shows inline confirm on Delete click', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancels delete when Cancel is clicked', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('dispatches deleteActivityThunk on confirm and navigates back', async () => {
    const { deleteActivityThunk } = jest.requireMock('../../../store/activitiesSlice')
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(deleteActivityThunk).toHaveBeenCalledWith('act-1')
      expect(mockNavigate).toHaveBeenCalledWith('/activities')
    })
  })

  it('back button navigates to /activities', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /← activities/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/activities')
  })
})
