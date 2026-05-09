import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import App from '../App'
import authReducer from '../store/authSlice'
import activitiesReducer from '../store/activitiesSlice'
import userReducer from '../store/userSlice'
import adminReducer from '../store/adminSlice'
import api from '../services/api'

jest.mock('../services/api')

const mockedApi = api as jest.Mocked<typeof api>

const mockUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin' as const,
  maxHR: 185,
}

function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      activities: activitiesReducer,
      user: userReducer,
      admin: adminReducer,
    },
  })
}

function renderApp() {
  return render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    </Provider>,
  )
}

describe('App', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing until /api/auth/me resolves', () => {
    mockedApi.get = jest.fn().mockImplementation(() => new Promise(() => {}))
    const { container } = renderApp()
    expect(container.firstChild).toBeNull()
  })

  it('renders routes after /api/auth/me succeeds', async () => {
    mockedApi.get = jest.fn().mockResolvedValue({ data: { user: mockUser } })
    renderApp()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'IDLR' })).toBeInTheDocument())
  })

  it('renders routes after /api/auth/me fails (unauthenticated)', async () => {
    mockedApi.get = jest.fn().mockRejectedValue(new Error('401'))
    renderApp()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'IDLR' })).toBeInTheDocument())
  })
})
