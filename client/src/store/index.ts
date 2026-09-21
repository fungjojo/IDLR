import { configureStore } from '@reduxjs/toolkit'
import authReducer, { logout } from './authSlice'
import activitiesReducer from './activitiesSlice'
import userReducer from './userSlice'
import adminReducer from './adminSlice'
import authListenerMiddleware from './authListener'
import { registerAuthFailureHandler } from '../services/api'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    activities: activitiesReducer,
    user: userReducer,
    admin: adminReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListenerMiddleware.middleware),
})

// Let the api layer trigger a logout on unrecoverable 401s without importing
// the store directly (which would create a store <-> services/api cycle).
registerAuthFailureHandler(() => store.dispatch(logout()))

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
