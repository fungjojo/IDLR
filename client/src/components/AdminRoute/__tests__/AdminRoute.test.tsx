import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../../../store/authSlice'
import { type BaseUser } from '../../../types/user'
import AdminRoute from '../index'

const adminUser: BaseUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin',
  maxHR: 185,
}

const memberUser: BaseUser = {
  id: '2',
  name: 'Member',
  email: 'member@test.com',
  role: 'member',
  maxHR: 180,
}

function makeStore(user: BaseUser | null) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { user, loading: false },
    },
  })
}

function renderWithRoutes(user: BaseUser | null, initialPath = '/admin') {
  const store = makeStore(user)
  const { container } = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Admin content</div>
              </AdminRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return { container }
}

describe('AdminRoute', () => {
  it('renders children when user is admin', () => {
    renderWithRoutes(adminUser)
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('redirects to /dashboard when user is a member', () => {
    renderWithRoutes(memberUser)
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    renderWithRoutes(null)
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('matches snapshot when user is admin', () => {
    const { container } = renderWithRoutes(adminUser)
    expect(container).toMatchSnapshot()
  })

  it('matches snapshot when user is a member', () => {
    const { container } = renderWithRoutes(memberUser)
    expect(container).toMatchSnapshot()
  })

  it('matches snapshot when not authenticated', () => {
    const { container } = renderWithRoutes(null)
    expect(container).toMatchSnapshot()
  })
})
