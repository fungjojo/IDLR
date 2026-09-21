import axios, { type InternalAxiosRequestConfig } from 'axios'

interface RetryConfig extends InternalAxiosRequestConfig {
  isRetry?: boolean
}

let isRefreshing = false
type QueueItem = { resolve: () => void; reject: (err: unknown) => void }
let pendingQueue: QueueItem[] = []

// Auth failure handler is injected by the store (see store/index.ts) instead of
// importing the store here directly — avoids an api <-> store import cycle.
let onAuthFailure: (() => void) | null = null
export function registerAuthFailureHandler(handler: () => void): void {
  onAuthFailure = handler
}

function flushQueue(error: unknown) {
  pendingQueue.forEach((item) => {
    if (error) item.reject(error)
    else item.resolve()
  })
  pendingQueue = []
}

function handleLogout() {
  onAuthFailure?.()
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
    if (!config || config.isRetry || config.url?.includes('/api/auth/refresh')) {
      handleLogout()
      return Promise.reject(error)
    }

    // Build a new config instead of mutating the caller's object — the retry flag
    // only needs to exist on the request we're about to (re)send.
    const retryConfig: RetryConfig = { ...config, isRetry: true }

    // If a refresh is already in flight, queue this request until it settles.
    // Note: this check-then-set is safe from races because everything above runs
    // synchronously (no `await` yet) — concurrent 401s can't interleave here.
    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      })
        .then(() => api(retryConfig))
        .catch((err: unknown) => Promise.reject(err))
    }

    isRefreshing = true

    try {
      await axios.post('/api/auth/refresh', null, { withCredentials: true })
      flushQueue(null)
      // eslint-disable-next-line @typescript-eslint/return-await
      return api(retryConfig)
    } catch (refreshError) {
      flushQueue(refreshError)
      handleLogout()
      // eslint-disable-next-line @typescript-eslint/return-await
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
