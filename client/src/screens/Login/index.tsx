import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../../store/hooks'
import { setCredentials } from '../../store/authSlice'
import api from '../../services/api'
import { ROUTES } from '../../constants/routes'
import { type BaseUser } from '../../types/user'
import styles from './Login.module.css'

interface LoginResponse {
  user: BaseUser
}

export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password })
      dispatch(setCredentials({ user: data.user }))
      navigate(ROUTES.DASHBOARD, { replace: true })
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 423 ? 'Account locked. Please try again later.' : 'Invalid email or password')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>IDLR</h1>
        <p className={styles.subtitle}>Sign in to your account</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
