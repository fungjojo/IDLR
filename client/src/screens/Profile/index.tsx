import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import styles from './Profile.module.css'

function stravaStatusMessage(param: string | null): { text: string; cls: string } | null {
  if (param === 'connected') return { text: 'Strava connected successfully.', cls: styles.statusSuccess }
  if (param === 'error') return { text: 'Something went wrong connecting Strava. Try again.', cls: styles.statusError }
  if (param === 'denied') return { text: 'Strava connection was cancelled.', cls: styles.statusDenied }
  return null
}

export default function Profile() {
  const user = useAppSelector((state) => state.auth.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const stravaParam = searchParams.get('strava')
  const statusMessage = stravaStatusMessage(stravaParam)

  useEffect(() => {
    if (!stravaParam) return
    const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000)
    return () => clearTimeout(t)
  }, [stravaParam, setSearchParams])

  const isStravaConnected = Boolean(user?.stravaAthleteId)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Profile</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Strava</h2>
        {isStravaConnected ? (
          <div className={styles.connected}>
            <span className={styles.connectedLabel}>Connected</span>
          </div>
        ) : (
          <a
            href="/api/strava/connect"
            className={styles.connectButton}
            data-testid="strava-connect-link"
          >
            Connect Strava
          </a>
        )}
        {statusMessage && (
          <p className={`${styles.statusMessage} ${statusMessage.cls}`} role="status">
            {statusMessage.text}
          </p>
        )}
      </div>
    </div>
  )
}
