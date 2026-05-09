import authReducer, { setCredentials, logout } from '../authSlice'

const mockUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin' as const,
  maxHR: 185,
}

const emptyState = { user: null, loading: false }

beforeEach(() => {
  localStorage.clear()
})

describe('authSlice', () => {
  describe('initialState', () => {
    it('returns empty state when localStorage is empty', () => {
      const state = authReducer(undefined, { type: '@@INIT' })
      expect(state.user).toBeNull()
      expect(state.loading).toBe(false)
    })

    it('hydrates user from localStorage on init', () => {
      localStorage.setItem('idlr_user', JSON.stringify(mockUser))

      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: freshReducer } = require('../authSlice')
      const state = freshReducer(undefined, { type: '@@INIT' })

      expect(state.user).toEqual(mockUser)
    })

    it('returns null user when idlr_user is invalid JSON', () => {
      localStorage.setItem('idlr_user', 'not-json')

      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: freshReducer } = require('../authSlice')
      const state = freshReducer(undefined, { type: '@@INIT' })

      expect(state.user).toBeNull()
    })
  })

  describe('setCredentials', () => {
    it('sets user in state', () => {
      const state = authReducer(emptyState, setCredentials({ user: mockUser }))
      expect(state.user).toEqual(mockUser)
    })

    it('does not write to localStorage (persistence is handled by authListener)', () => {
      authReducer(emptyState, setCredentials({ user: mockUser }))
      expect(localStorage.getItem('idlr_user')).toBeNull()
    })
  })

  describe('logout', () => {
    it('clears user from state', () => {
      const loggedIn = { user: mockUser, loading: false }
      const state = authReducer(loggedIn, logout())
      expect(state.user).toBeNull()
    })

    it('does not touch localStorage (persistence is handled by authListener)', () => {
      localStorage.setItem('idlr_user', JSON.stringify(mockUser))
      authReducer({ user: mockUser, loading: false }, logout())
      expect(localStorage.getItem('idlr_user')).toBe(JSON.stringify(mockUser))
    })
  })
})
