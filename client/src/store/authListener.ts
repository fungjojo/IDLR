import { createListenerMiddleware } from '@reduxjs/toolkit'

// Auth state is no longer persisted to localStorage. Session is re-hydrated
// server-side via GET /api/auth/me on app load. This middleware is kept as a
// registered entry point for future side-effect listeners (e.g. analytics).
const authListenerMiddleware = createListenerMiddleware()

export default authListenerMiddleware
