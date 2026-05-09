import { configureStore } from '@reduxjs/toolkit'
import authReducer, { setCredentials, logout } from '../authSlice'
import authListenerMiddleware from '../authListener'

const mockUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin' as const,
  maxHR: 185,
}

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(authListenerMiddleware.middleware),
  })
}

beforeEach(() => { localStorage.clear() })

describe('authListenerMiddleware', () => {
  it('does not persist user to localStorage on setCredentials', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: mockUser }))
    expect(localStorage.getItem('idlr_user')).toBeNull()
  })

  it('does not touch localStorage on logout', () => {
    const store = makeStore()
    store.dispatch(logout())
    expect(localStorage.getItem('idlr_user')).toBeNull()
  })
})
