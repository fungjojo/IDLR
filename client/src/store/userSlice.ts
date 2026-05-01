import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface UserProfile {
  id: string
  name: string
  email: string
  maxHR: number
  stravaConnected: boolean
}

interface UserState {
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

const initialState: UserState = {
  profile: null,
  loading: false,
  error: null,
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<UserProfile>) {
      state.profile = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const { setProfile, setLoading, setError } = userSlice.actions
export default userSlice.reducer
