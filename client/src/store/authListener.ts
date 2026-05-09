import { createListenerMiddleware } from '@reduxjs/toolkit'
import { setCredentials, logout, USER_KEY } from './authSlice'

const authListenerMiddleware = createListenerMiddleware()

authListenerMiddleware.startListening({
  actionCreator: setCredentials,
  effect(action) {
    localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
  },
})

authListenerMiddleware.startListening({
  actionCreator: logout,
  effect() {
    localStorage.removeItem(USER_KEY)
  },
})

export default authListenerMiddleware
