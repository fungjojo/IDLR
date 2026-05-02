import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { BaseUser } from '../types/user'

type AuthUser = BaseUser

interface AuthState {
  token: string | null
  user: AuthUser | null
  loading: boolean
}

const TOKEN_KEY = 'idlr_token'
const USER_KEY = 'idlr_user'

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
    token: localStorage.getItem(TOKEN_KEY),
    user: loadUser(),
    loading: false,
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: buildInitialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.token = action.payload.token
      state.user = action.payload.user
      localStorage.setItem(TOKEN_KEY, action.payload.token)
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
    },
    logout(state) {
      state.token = null
      state.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
