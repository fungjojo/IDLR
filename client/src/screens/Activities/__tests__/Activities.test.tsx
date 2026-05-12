import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Activities from '../index'
import * as activitiesService from '../../../services/activities'

jest.mock('../../../services/api')
jest.mock('../../../services/activities')

const mockedUpload = activitiesService.uploadActivity as jest.MockedFunction<typeof activitiesService.uploadActivity>

const MOCK_ACTIVITY: activitiesService.Activity = {
  _id: 'act-1',
  name: 'Morning Run',
  date: '2024-03-01T08:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1800,
  avgHR: 145,
  maxHR: 175,
  source: 'manual',
}

function renderScreen() {
  return render(<Activities />)
}

describe('Activities screen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('matches snapshot', () => {
    const { asFragment } = renderScreen()
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders upload dropzone', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /upload activity file/i })).toBeInTheDocument()
    expect(screen.getByText(/drop a .fit or .gpx file/i)).toBeInTheDocument()
  })

  it('shows error for unsupported file type', async () => {
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['data'], 'run.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText(/only .fit and .gpx/i)).toBeInTheDocument()
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  it('uploads a .gpx file and shows result', async () => {
    mockedUpload.mockResolvedValue(MOCK_ACTIVITY)
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['<gpx/>'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Morning Run')).toBeInTheDocument()
    expect(screen.getByText(/5\.00 km/)).toBeInTheDocument()
    expect(screen.getByText(/Avg HR 145 bpm/)).toBeInTheDocument()
  })

  it('uploads a .fit file and shows result', async () => {
    mockedUpload.mockResolvedValue(MOCK_ACTIVITY)
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File([new Uint8Array([0x0e, 0x10])], 'run.fit', { type: 'application/octet-stream' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Morning Run')).toBeInTheDocument()
  })

  it('shows API error message on upload failure', async () => {
    mockedUpload.mockRejectedValue({
      response: { data: { message: 'Could not parse file' } },
    })
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['bad'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Could not parse file')).toBeInTheDocument()
  })

  it('shows fallback error message when no API message', async () => {
    mockedUpload.mockRejectedValue(new Error('Network error'))
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['bad'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Upload failed')).toBeInTheDocument()
  })

  it('shows uploading state', async () => {
    mockedUpload.mockReturnValue(new Promise(() => {}))
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['<gpx/>'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/uploading/i)).toBeInTheDocument())
  })

  it('stacks multiple uploads', async () => {
    const second = { ...MOCK_ACTIVITY, _id: 'act-2', name: 'Afternoon Run' }
    mockedUpload.mockResolvedValueOnce(MOCK_ACTIVITY).mockResolvedValueOnce(second)
    renderScreen()
    const input = screen.getByTestId('file-input')

    fireEvent.change(input, { target: { files: [new File(['<gpx/>'], 'run1.gpx')] } })
    await screen.findByText('Morning Run')

    fireEvent.change(input, { target: { files: [new File(['<gpx/>'], 'run2.gpx')] } })
    await screen.findByText('Afternoon Run')

    expect(screen.getByText('Morning Run')).toBeInTheDocument()
  })
})
