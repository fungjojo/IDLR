import { configureStore } from '@reduxjs/toolkit'
import authReducer, { setCredentials, logout, USER_KEY } from '../authSlice'
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

beforeEach(() => {
  localStorage.clear()
})

describe('authListenerMiddleware', () => {
  describe('setCredentials', () => {
    it('persists user to localStorage as JSON', () => {
      const store = makeStore()
      store.dispatch(setCredentials({ user: mockUser }))
      expect(JSON.parse(localStorage.getItem(USER_KEY) ?? '')).toEqual(mockUser)
    })
  })

  describe('logout', () => {
    it('removes user from localStorage', () => {
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser))
      const store = makeStore()
      store.dispatch(logout())
      expect(localStorage.getItem(USER_KEY)).toBeNull()
    })
  })
})
