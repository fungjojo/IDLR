import userReducer, { setProfile, setLoading, setError } from '../userSlice'

const mockProfile = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  maxHR: 185,
  stravaConnected: false,
}

const initialState = { profile: null, loading: false, error: null }

describe('userSlice', () => {
  it('returns initial state', () => {
    const state = userReducer(undefined, { type: '@@INIT' })
    expect(state).toEqual(initialState)
  })

  describe('setProfile', () => {
    it('sets the profile', () => {
      const state = userReducer(initialState, setProfile(mockProfile))
      expect(state.profile).toEqual(mockProfile)
    })

    it('overwrites an existing profile', () => {
      const state = userReducer(
        { ...initialState, profile: mockProfile },
        setProfile({ ...mockProfile, name: 'Updated Name' }),
      )
      expect(state.profile?.name).toBe('Updated Name')
    })
  })

  describe('setLoading', () => {
    it('sets loading to true', () => {
      const state = userReducer(initialState, setLoading(true))
      expect(state.loading).toBe(true)
    })

    it('sets loading back to false', () => {
      const state = userReducer({ ...initialState, loading: true }, setLoading(false))
      expect(state.loading).toBe(false)
    })
  })

  describe('setError', () => {
    it('sets an error message', () => {
      const state = userReducer(initialState, setError('Failed to load profile'))
      expect(state.error).toBe('Failed to load profile')
    })

    it('clears error with null', () => {
      const state = userReducer({ ...initialState, error: 'oops' }, setError(null))
      expect(state.error).toBeNull()
    })
  })
})
