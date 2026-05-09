import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BaseUser } from '../types/user'

type AuthUser = BaseUser

interface AuthState {
  user: AuthUser | null
  loading: boolean
  initialized: boolean
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, loading: false, initialized: false } as AuthState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: AuthUser }>) {
      state.user = action.payload.user
    },
    logout(state) {
      state.user = null
    },
    // One-shot flag: true once the initial /api/auth/me check resolves (success or
    // failure). Never reset — re-auth flows must do a full page reload to re-trigger.
    setInitialized(state) {
      state.initialized = true
    },
  },
})

export const { setCredentials, logout, setInitialized } = authSlice.actions
export default authSlice.reducer
