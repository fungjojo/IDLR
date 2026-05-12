import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { uploadActivity, type Activity } from '../../services/activities'
import styles from './Activities.module.css'

const ACCEPTED_EXTENSIONS = ['.fit', '.gpx']

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

export default function Activities() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<Activity[]>([])

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await processFile(file)
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
    e.target.value = ''
  }

  async function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(`.${ext ?? ''}`)) {
      setError('Only .fit and .gpx files are supported')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const activity = await uploadActivity(file)
      setUploaded(prev => [activity, ...prev])
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Upload failed')
          : 'Upload failed'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  const dropzoneClass = [
    styles.dropzone,
    dragging ? styles.dropzoneActive : '',
    uploading ? styles.dropzoneUploading : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Activities</h1>

      <div
        className={dropzoneClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        aria-label="Upload activity file"
      >
        <p className={styles.dropzoneLabel}>
          {uploading ? 'Uploading…' : 'Drop a .fit or .gpx file here'}
        </p>
        <p className={styles.dropzoneHint}>or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept=".fit,.gpx"
          className={styles.hiddenInput}
          onChange={handleFileChange}
          data-testid="file-input"
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {uploaded.length > 0 && (
        <>
          <h2 className={styles.recentTitle}>Uploaded this session</h2>
          {uploaded.map(a => (
            <div key={a._id} className={styles.activityCard}>
              <p className={styles.activityName}>{a.name}</p>
              <p className={styles.activityMeta}>
                {new Date(a.date).toLocaleDateString()} &middot;{' '}
                {formatDistance(a.distanceMeters)} &middot;{' '}
                {formatDuration(a.durationSeconds)} &middot;{' '}
                Avg HR {a.avgHR} bpm
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
