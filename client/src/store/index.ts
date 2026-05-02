import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import activitiesReducer from './activitiesSlice'
import userReducer from './userSlice'
import authListenerMiddleware from './authListener'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    activities: activitiesReducer,
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListenerMiddleware.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
