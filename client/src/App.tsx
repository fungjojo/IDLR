import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import { ROUTES } from './constants/routes'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import Activities from './screens/Activities'
import ActivityDetail from './screens/ActivityDetail'
import ZoneAnalysis from './screens/ZoneAnalysis'
import VideoAnalysis from './screens/VideoAnalysis'
import Profile from './screens/Profile'
import Admin from './screens/Admin'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((state) => state.auth.token)
  return token ? <>{children}</> : <Navigate to={ROUTES.LOGIN} replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAppSelector((state) => state.auth)
  if (!token) return <Navigate to={ROUTES.LOGIN} replace />
  if (user?.role !== 'admin') return <Navigate to={ROUTES.DASHBOARD} replace />
  return <>{children}</>
}

export default function App() {
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
