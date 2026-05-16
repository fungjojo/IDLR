import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchActivityThunk, deleteActivityThunk } from '../../store/activitiesSlice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import StatCard from '../../components/StatCard'
import HRChart from '../../components/HRChart'
import { ROUTES } from '../../constants/routes'
import styles from './ActivityDetail.module.css'

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

function avgPace(paceStream: number[]): string | null {
  if (!paceStream.length) return null
  const avg = paceStream.reduce((sum, v) => sum + v, 0) / paceStream.length
  const mins = Math.floor(avg / 60)
  const secs = Math.round(avg % 60)
  return `${mins}:${String(secs).padStart(2, '0')} /km`
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { selected, loading, error } = useAppSelector((s) => s.activities)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (id) dispatch(fetchActivityThunk(id))
  }, [dispatch, id])

  async function handleDelete() {
    if (!selected) return
    try {
      await dispatch(deleteActivityThunk(selected._id)).unwrap()
      navigate(ROUTES.ACTIVITIES)
    } catch {
      // thunk rejected — stay on page (slice error state handles the message)
    }
  }

  if (loading) return <p className={styles.loading}>Loading…</p>
  if (error) return <p className={styles.error}>{error}</p>
  if (!selected) return null

  const pace = avgPace(selected.paceStream)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate(ROUTES.ACTIVITIES)}
          aria-label="← Activities"
        >
          ← Activities
        </button>

        {confirming ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmMsg}>Delete this activity?</span>
            <button className={styles.confirmBtn} onClick={handleDelete} aria-label="Confirm">
              Confirm
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => setConfirming(false)}
              aria-label="Cancel"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={styles.deleteBtn}
            onClick={() => setConfirming(true)}
            aria-label="Delete"
          >
            Delete
          </button>
        )}
      </div>

      <h1 className={styles.name}>{selected.name}</h1>
      <p className={styles.meta}>
        {new Date(selected.date).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        {' · '}
        <span className={styles.source}>{selected.source}</span>
      </p>

      <div className={styles.statCards}>
        <StatCard label="Distance" value={formatDistance(selected.distanceMeters)} />
        <StatCard label="Time" value={formatDuration(selected.durationSeconds)} />
        <StatCard label="Avg HR" value={`${selected.avgHR} bpm`} accentColor="#dc2626" />
        <StatCard label="Max HR" value={`${selected.maxHR} bpm`} accentColor="#f97316" />
      </div>

      {selected.hrStream.length > 0 && (
        <div className={styles.chart}>
          <HRChart hrStream={selected.hrStream} durationSeconds={selected.durationSeconds} />
        </div>
      )}

      <div className={styles.pills}>
        {pace && <span className={styles.pill}>Pace: {pace}</span>}
        {selected.cadenceAvg != null && (
          <span className={styles.pill}>Cadence: {selected.cadenceAvg} spm</span>
        )}
        {selected.elevationGainMeters != null && (
          <span className={styles.pill}>
            Elevation: +{Math.round(selected.elevationGainMeters)} m
          </span>
        )}
      </div>
    </div>
  )
}
