import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Member } from '../services/users'

interface AdminState {
  members: Member[]
  loading: boolean
  error: string | null
}

const initialState: AdminState = {
  members: [],
  loading: false,
  error: null,
}

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setMembers(state, action: PayloadAction<Member[]>) {
      state.members = action.payload
    },
    addMember(state, action: PayloadAction<Member>) {
      state.members.unshift(action.payload)
    },
    removeMember(state, action: PayloadAction<string>) {
      state.members = state.members.filter((m) => m.id !== action.payload)
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const { setMembers, addMember, removeMember, setLoading, setError } = adminSlice.actions
export default adminSlice.reducer
