import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import Profile from '../index'
import authReducer from '../../../store/authSlice'

jest.mock('../../../services/api')

function makeStore(stravaAthleteId?: number) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: { id: 'u1', name: 'Jojo', email: 'j@j.com', role: 'member' as const, maxHR: 185, stravaAthleteId },
        loading: false,
        initialized: true,
      },
    },
  })
}

function renderProfile(initialPath = '/profile', stravaAthleteId?: number) {
  return render(
    <Provider store={makeStore(stravaAthleteId)}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('Profile screen', () => {
  it('matches snapshot when not connected', () => {
    const { asFragment } = renderProfile()
    expect(asFragment()).toMatchSnapshot()
  })

  it('shows Connect Strava link when not connected', () => {
    renderProfile()
    expect(screen.getByTestId('strava-connect-link')).toBeInTheDocument()
    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
  })

  it('shows Connected label when Strava is linked', () => {
    renderProfile('/profile', 42)
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.queryByTestId('strava-connect-link')).not.toBeInTheDocument()
  })

  it('shows success message on strava=connected query param', () => {
    renderProfile('/profile?strava=connected')
    expect(screen.getByRole('status')).toHaveTextContent('successfully')
  })

  it('shows error message on strava=error query param', () => {
    renderProfile('/profile?strava=error')
    expect(screen.getByRole('status')).toHaveTextContent('went wrong')
  })

  it('shows denied message on strava=denied query param', () => {
    renderProfile('/profile?strava=denied')
    expect(screen.getByRole('status')).toHaveTextContent('cancelled')
  })

  it('clears status message after 4 seconds', async () => {
    jest.useFakeTimers()
    renderProfile('/profile?strava=connected')
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => jest.advanceTimersByTime(4000))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    jest.useRealTimers()
  })
})
