import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import Activities from './screens/Activities'
import ActivityDetail from './screens/ActivityDetail'
import ZoneAnalysis from './screens/ZoneAnalysis'
import VideoAnalysis from './screens/VideoAnalysis'
import Profile from './screens/Profile'
import Admin from './screens/Admin'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { setCredentials, setInitialized } from './store/authSlice'
import axios from 'axios'
import api from './services/api'
import type { BaseUser } from './types/user'

export default function App() {
  const dispatch = useAppDispatch()
  const initialized = useAppSelector((state) => state.auth.initialized)

  useEffect(() => {
    api.get<{ user: BaseUser }>('/api/auth/me')
      .then(({ data }) => { dispatch(setCredentials({ user: data.user })) })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) return
        console.error('[auth/me]', err)
      })
      .finally(() => { dispatch(setInitialized()) })
  }, [dispatch])

  if (!initialized) return null

  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route path={ROUTES.DASHBOARD} element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path={ROUTES.ACTIVITIES} element={<PrivateRoute><Activities /></PrivateRoute>} />
      <Route path={ROUTES.ACTIVITY_DETAIL} element={<PrivateRoute><ActivityDetail /></PrivateRoute>} />
      <Route path={ROUTES.ZONE_ANALYSIS} element={<PrivateRoute><ZoneAnalysis /></PrivateRoute>} />
      <Route path={ROUTES.VIDEO_ANALYSIS} element={<PrivateRoute><VideoAnalysis /></PrivateRoute>} />
      <Route path={ROUTES.PROFILE} element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path={ROUTES.ADMIN} element={<AdminRoute><Admin /></AdminRoute>} />
      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  )
}
