import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import Login from '../index'
import authReducer from '../../../store/authSlice'
import api from '../../../services/api'

jest.mock('../../../services/api')

const mockedApi = api as jest.Mocked<typeof api>

function renderLogin() {
  const store = configureStore({ reducer: { auth: authReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </Provider>,
  )
}

describe('Login', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the login form', () => {
    const { container } = renderLogin()
    expect(screen.getByRole('heading', { name: 'IDLR' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(container).toMatchSnapshot()
  })

  it('shows error message and clears password on failed login', async () => {
    mockedApi.post = jest.fn().mockRejectedValue(new Error('401'))
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toHaveValue('')
    })
  })

  it('disables the button while loading', async () => {
    mockedApi.post = jest.fn().mockImplementation(() => new Promise(() => {}))
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    })
  })
})
