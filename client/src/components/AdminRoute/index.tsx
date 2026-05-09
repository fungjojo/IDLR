import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { ROUTES } from '../../constants/routes'

interface Props {
  children: ReactNode
}

export default function AdminRoute({ children }: Props) {
  const user = useAppSelector((state) => state.auth.user)
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />
  if (user.role !== 'admin') return <Navigate to={ROUTES.DASHBOARD} replace />
  return <>{children}</>
}
