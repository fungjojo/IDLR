import axios from 'axios'
import { store } from '../store'
import { logout } from '../store/authSlice'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      store.dispatch(logout())
      // Clear the httpOnly cookie server-side using bare axios to avoid re-entering this interceptor
      axios.post('/api/auth/logout', null, { withCredentials: true }).catch(() => {})
    }
    return Promise.reject(error)
  },
)

export default api
