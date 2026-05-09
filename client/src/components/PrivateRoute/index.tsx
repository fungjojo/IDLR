import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { ROUTES } from '../../constants/routes'

interface Props {
  children: ReactNode
}

export default function PrivateRoute({ children }: Props) {
  const user = useAppSelector((state) => state.auth.user)
  return user ? <>{children}</> : <Navigate to={ROUTES.LOGIN} replace />
}
