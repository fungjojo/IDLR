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
    setInitialized(state) {
      state.initialized = true
    },
  },
})

export const { setCredentials, logout, setInitialized } = authSlice.actions
export default authSlice.reducer
