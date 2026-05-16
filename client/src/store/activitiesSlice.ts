import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { fetchActivities, fetchActivity, deleteActivity } from '../services/activities'
import type { Activity, PaginatedActivities } from '../types/activity'

export type { Activity }

export interface ActivitiesState {
  items: Activity[]
  selected: Activity | null
  total: number
  page: number
  pages: number
  loading: boolean
  error: string | null
}

const initialState: ActivitiesState = {
  items: [],
  selected: null,
  total: 0,
  page: 1,
  pages: 0,
  loading: false,
  error: null,
}

export const fetchActivitiesThunk = createAsyncThunk<
  PaginatedActivities,
  { page: number; limit: number }
>('activities/fetchActivities', ({ page, limit }) => fetchActivities(page, limit))

export const fetchActivityThunk = createAsyncThunk<Activity, string>(
  'activities/fetchActivity',
  (id) => fetchActivity(id),
)

export const deleteActivityThunk = createAsyncThunk<string, string>(
  'activities/deleteActivity',
  async (id) => {
    await deleteActivity(id)
    return id
  },
)

const activitiesSlice = createSlice({
  name: 'activities',
  initialState,
  reducers: {
    setActivities(state, action: PayloadAction<Activity[]>) {
      state.items = action.payload
    },
    setSelected(state, action: PayloadAction<Activity>) {
      state.selected = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    removeActivity(state, action: PayloadAction<string>) {
      state.items = state.items.filter((a) => a._id !== action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivitiesThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchActivitiesThunk.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.activities
        state.total = action.payload.total
        state.page = action.payload.page
        state.pages = action.payload.pages
      })
      .addCase(fetchActivitiesThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch activities'
      })
      .addCase(fetchActivityThunk.pending, (state) => {
        state.loading = true
        state.error = null
        state.selected = null
      })
      .addCase(fetchActivityThunk.fulfilled, (state, action) => {
        state.loading = false
        state.selected = action.payload
      })
      .addCase(fetchActivityThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch activity'
      })
      .addCase(deleteActivityThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteActivityThunk.fulfilled, (state, action) => {
        state.loading = false
        state.items = state.items.filter((a) => a._id !== action.payload)
        if (state.selected?._id === action.payload) {
          state.selected = null
        }
      })
      .addCase(deleteActivityThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to delete activity'
      })
  },
})

export const { setActivities, setSelected, setLoading, setError, removeActivity } =
  activitiesSlice.actions
export default activitiesSlice.reducer
