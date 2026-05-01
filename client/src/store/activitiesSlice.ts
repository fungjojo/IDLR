import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Activity {
  _id: string
  userId: string
  source: 'strava' | 'manual'
  name: string
  date: string
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  hrStream: number[]
  paceStream: number[]
  cadenceAvg?: number
  elevationGainMeters?: number
}

interface ActivitiesState {
  items: Activity[]
  selected: Activity | null
  loading: boolean
  error: string | null
}

const initialState: ActivitiesState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
}

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
})

export const { setActivities, setSelected, setLoading, setError, removeActivity } =
  activitiesSlice.actions
export default activitiesSlice.reducer
