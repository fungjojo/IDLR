import { createListenerMiddleware } from '@reduxjs/toolkit'
import { setCredentials, logout, TOKEN_KEY, USER_KEY } from './authSlice'

const authListenerMiddleware = createListenerMiddleware()

authListenerMiddleware.startListening({
  actionCreator: setCredentials,
  effect(action) {
    localStorage.setItem(TOKEN_KEY, action.payload.token)
    localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
  },
})

authListenerMiddleware.startListening({
  actionCreator: logout,
  effect() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
})

export default authListenerMiddleware
