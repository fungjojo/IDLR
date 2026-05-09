import axios, { type InternalAxiosRequestConfig } from 'axios'
import { store } from '../store'
import { logout } from '../store/authSlice'

interface RetryConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean
}

let isRefreshing = false
type QueueItem = { resolve: () => void; reject: (err: unknown) => void }
let pendingQueue: QueueItem[] = []

function flushQueue(error: unknown) {
  for (const item of pendingQueue) {
    if (error) item.reject(error)
    else item.resolve()
  }
  pendingQueue = []
}

function handleLogout() {
  store.dispatch(logout())
  axios.post('/api/auth/logout', null, { withCredentials: true }).catch(() => {})
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const config = error.config as RetryConfig | undefined

    // Prevent infinite loop: refresh endpoint returned 401, or already retried
    if (!config || config._isRetry || config.url?.includes('/api/auth/refresh')) {
      handleLogout()
      return Promise.reject(error)
    }

    // If a refresh is already in flight, queue this request until it settles
    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      })
        .then(() => { config._isRetry = true; return api(config) })
        .catch((err: unknown) => Promise.reject(err))
    }

    isRefreshing = true
    config._isRetry = true

    try {
      await axios.post('/api/auth/refresh', null, { withCredentials: true })
      flushQueue(null)
      return api(config)
    } catch (refreshError) {
      flushQueue(refreshError)
      handleLogout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
