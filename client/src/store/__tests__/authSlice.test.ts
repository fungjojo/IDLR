import authReducer, { setCredentials, logout } from '../authSlice'

const mockUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin' as const,
  maxHR: 185,
}

const emptyState = { token: null, user: null, loading: false }

beforeEach(() => {
  localStorage.clear()
})

describe('authSlice', () => {
  describe('initialState', () => {
    it('returns empty state when localStorage is empty', () => {
      const state = authReducer(undefined, { type: '@@INIT' })
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
      expect(state.loading).toBe(false)
    })

    it('hydrates token and user from localStorage on init', () => {
      localStorage.setItem('idlr_token', 'abc123')
      localStorage.setItem('idlr_user', JSON.stringify(mockUser))

      // Re-import to pick up the pre-seeded localStorage
      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: freshReducer } = require('../authSlice')
      const state = freshReducer(undefined, { type: '@@INIT' })

      expect(state.token).toBe('abc123')
      expect(state.user).toEqual(mockUser)
    })

    it('returns null user when idlr_user is invalid JSON', () => {
      localStorage.setItem('idlr_token', 'abc123')
      localStorage.setItem('idlr_user', 'not-json')

      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: freshReducer } = require('../authSlice')
      const state = freshReducer(undefined, { type: '@@INIT' })

      expect(state.user).toBeNull()
    })
  })

  describe('setCredentials', () => {
    it('sets token and user in state', () => {
      const state = authReducer(emptyState, setCredentials({ token: 'tok', user: mockUser }))
      expect(state.token).toBe('tok')
      expect(state.user).toEqual(mockUser)
    })

    it('does not write to localStorage (persistence is handled by authListener)', () => {
      authReducer(emptyState, setCredentials({ token: 'tok', user: mockUser }))
      expect(localStorage.getItem('idlr_token')).toBeNull()
      expect(localStorage.getItem('idlr_user')).toBeNull()
    })
  })

  describe('logout', () => {
    it('clears token and user from state', () => {
      const loggedIn = { token: 'tok', user: mockUser, loading: false }
      const state = authReducer(loggedIn, logout())
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
    })

    it('does not touch localStorage (persistence is handled by authListener)', () => {
      localStorage.setItem('idlr_token', 'tok')
      localStorage.setItem('idlr_user', JSON.stringify(mockUser))
      authReducer({ token: 'tok', user: mockUser, loading: false }, logout())
      // Reducer is pure — storage is unchanged; listener handles removal
      expect(localStorage.getItem('idlr_token')).toBe('tok')
      expect(localStorage.getItem('idlr_user')).toBe(JSON.stringify(mockUser))
    })
  })
})
