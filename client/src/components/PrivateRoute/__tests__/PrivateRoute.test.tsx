import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../../../store/authSlice'
import { type BaseUser } from '../../../types/user'
import PrivateRoute from '../index'

const mockUser: BaseUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin',
  maxHR: 185,
}

function makeStore(user: BaseUser | null) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { user, loading: false },
    },
  })
}

function renderWithRoute(user: BaseUser | null, initialPath = '/protected') {
  const store = makeStore(user)
  const { container } = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <PrivateRoute>
                <div>Protected content</div>
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return { container }
}

describe('PrivateRoute', () => {
  it('renders children when authenticated', () => {
    renderWithRoute(mockUser)
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    renderWithRoute(null)
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('matches snapshot when authenticated', () => {
    const { container } = renderWithRoute(mockUser)
    expect(container).toMatchSnapshot()
  })

  it('matches snapshot when not authenticated', () => {
    const { container } = renderWithRoute(null)
    expect(container).toMatchSnapshot()
  })
})
