import authReducer, { setCredentials, logout, setInitialized } from '../authSlice'

const mockUser = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'admin' as const,
  maxHR: 185,
}

const emptyState = { user: null, loading: false, initialized: false }

describe('authSlice', () => {
  describe('initialState', () => {
    it('starts with null user and initialized false', () => {
      const state = authReducer(undefined, { type: '@@INIT' })
      expect(state.user).toBeNull()
      expect(state.initialized).toBe(false)
    })

    it('does not read from localStorage', () => {
      localStorage.setItem('idlr_user', JSON.stringify(mockUser))
      const state = authReducer(undefined, { type: '@@INIT' })
      expect(state.user).toBeNull()
    })
  })

  describe('setCredentials', () => {
    it('sets user in state', () => {
      const state = authReducer(emptyState, setCredentials({ user: mockUser }))
      expect(state.user).toEqual(mockUser)
    })
  })

  describe('logout', () => {
    it('clears user from state', () => {
      const state = authReducer({ ...emptyState, user: mockUser }, logout())
      expect(state.user).toBeNull()
    })
  })

  describe('setInitialized', () => {
    it('sets initialized to true', () => {
      const state = authReducer(emptyState, setInitialized())
      expect(state.initialized).toBe(true)
    })
  })
})
