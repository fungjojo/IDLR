import type { Activity } from '../../types/activity'
import styles from './ActivityCard.module.css'

interface ActivityCardProps {
  activity: Activity
  onClick: () => void
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ActivityCard({ activity, onClick }: ActivityCardProps) {
  const date = new Date(activity.date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div
      className={styles.card}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.header}>
        <p className={styles.name}>{activity.name}</p>
        <p className={styles.meta}>
          {date}
          {' · '}
          <span className={styles.source}>{activity.source}</span>
        </p>
      </div>
      <div className={styles.stats}>
        <span className={styles.stat}>{formatDistance(activity.distanceMeters)}</span>
        <span className={styles.sep}>·</span>
        <span className={styles.stat}>{formatDuration(activity.durationSeconds)}</span>
        <span className={styles.sep}>·</span>
        <span className={`${styles.stat} ${styles.hrAvg}`}>♥ {activity.avgHR} avg</span>
        <span className={styles.sep}>·</span>
        <span className={`${styles.stat} ${styles.hrMax}`}>♥ {activity.maxHR} max</span>
      </div>
    </div>
  )
}
