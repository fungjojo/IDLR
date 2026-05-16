import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Activities from '../index'
import * as activitiesService from '../../../services/activities'
import type { Activity } from '../../../types/activity'

jest.mock('../../../services/api')
jest.mock('../../../services/activities')

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

const mockDispatch = jest.fn().mockReturnValue(Promise.resolve({ payload: undefined }))

jest.mock('../../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}))

jest.mock('../../../store/activitiesSlice', () => ({
  fetchActivitiesThunk: jest.fn((args: unknown) => ({
    type: 'activities/fetchActivities/pending',
    payload: args,
  })),
}))

import { useAppSelector } from '../../../store/hooks'
const mockUseAppSelector = useAppSelector as jest.Mock

const mockedUpload = activitiesService.uploadActivity as jest.MockedFunction<
  typeof activitiesService.uploadActivity
>

const MOCK_ACTIVITY: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  name: 'Morning Run',
  date: '2024-03-01T08:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1800,
  avgHR: 145,
  maxHR: 175,
  source: 'manual',
  hrStream: [],
  paceStream: [],
}

const DEFAULT_STATE = {
  items: [],
  loading: false,
  error: null,
  page: 1,
  pages: 0,
}

function renderScreen(stateOverrides = {}) {
  mockUseAppSelector.mockReturnValue({ ...DEFAULT_STATE, ...stateOverrides })
  return render(
    <MemoryRouter>
      <Activities />
    </MemoryRouter>,
  )
}

describe('Activities screen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('matches snapshot', () => {
    const { asFragment } = renderScreen()
    expect(asFragment()).toMatchSnapshot()
  })

  it('dispatches fetchActivitiesThunk on mount', () => {
    const { fetchActivitiesThunk } = jest.requireMock('../../../store/activitiesSlice')
    renderScreen()
    expect(fetchActivitiesThunk).toHaveBeenCalledWith({ page: 1, limit: 10 })
  })

  it('renders upload dropzone', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /upload activity file/i })).toBeInTheDocument()
  })

  it('renders activity cards when items exist', () => {
    renderScreen({ items: [MOCK_ACTIVITY] })
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    renderScreen({ loading: true })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error from redux state', () => {
    renderScreen({ error: 'Failed to load' })
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('shows empty state when no items', () => {
    renderScreen({ items: [] })
    expect(screen.getByText(/no activities yet/i)).toBeInTheDocument()
  })

  it('clicking an activity card navigates to its detail route', () => {
    renderScreen({ items: [MOCK_ACTIVITY] })
    fireEvent.click(screen.getByRole('button', { name: /morning run/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/activities/act-1')
  })

  it('shows pagination when pages > 1', () => {
    renderScreen({ items: [MOCK_ACTIVITY], page: 1, pages: 3 })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/i })).toBeInTheDocument()
  })

  it('prev button is disabled on first page', () => {
    renderScreen({ items: [MOCK_ACTIVITY], page: 1, pages: 3 })
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
  })

  it('next button is disabled on last page', () => {
    renderScreen({ items: [MOCK_ACTIVITY], page: 3, pages: 3 })
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('dispatches fetchActivitiesThunk with next page on Next click', () => {
    const { fetchActivitiesThunk } = jest.requireMock('../../../store/activitiesSlice')
    renderScreen({ items: [MOCK_ACTIVITY], page: 1, pages: 3 })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(fetchActivitiesThunk).toHaveBeenCalledWith({ page: 2, limit: 10 })
  })

  it('shows error for unsupported file type', async () => {
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['data'], 'run.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText(/only .fit and .gpx/i)).toBeInTheDocument()
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  it('uploads a .gpx file and refreshes list', async () => {
    mockedUpload.mockResolvedValue(MOCK_ACTIVITY)
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['<gpx/>'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(2))
  })

  it('shows API error on upload failure', async () => {
    mockedUpload.mockRejectedValue({ response: { data: { message: 'Could not parse file' } } })
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['bad'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Could not parse file')).toBeInTheDocument()
  })
})
