import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { ROUTES } from '../../constants/routes'

interface Props {
  children: ReactNode
}

export default function PrivateRoute({ children }: Props) {
  const token = useAppSelector((state) => state.auth.token)
  return token ? <>{children}</> : <Navigate to={ROUTES.LOGIN} replace />
}
