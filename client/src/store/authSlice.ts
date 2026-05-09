import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BaseUser } from '../types/user'

type AuthUser = BaseUser

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

export const USER_KEY = 'idlr_user'

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function buildInitialState(): AuthState {
  return {
    user: loadUser(),
    loading: false,
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: buildInitialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: AuthUser }>) {
      state.user = action.payload.user
    },
    logout(state) {
      state.user = null
    },
  },
})

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
