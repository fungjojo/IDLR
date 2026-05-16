import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadActivity } from '../../services/activities'
import { fetchActivitiesThunk } from '../../store/activitiesSlice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import ActivityCard from '../../components/ActivityCard'
import { ROUTES } from '../../constants/routes'
import styles from './Activities.module.css'

const ACCEPTED_EXTENSIONS = ['.fit', '.gpx']
const PAGE_LIMIT = 10

export default function Activities() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items, loading, error, page, pages } = useAppSelector((s) => s.activities)

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchActivitiesThunk({ page: 1, limit: PAGE_LIMIT }))
  }, [dispatch])

  function handlePageChange(newPage: number) {
    dispatch(fetchActivitiesThunk({ page: newPage, limit: PAGE_LIMIT }))
  }

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
      setUploadError('Only .fit and .gpx files are supported')
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      await uploadActivity(file)
      dispatch(fetchActivitiesThunk({ page: 1, limit: PAGE_LIMIT }))
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Upload failed')
          : 'Upload failed'
      setUploadError(msg)
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

      {uploadError && <p className={styles.error}>{uploadError}</p>}

      {loading && <p className={styles.loading}>Loading…</p>}
      {error && !loading && <p className={styles.error}>{error}</p>}

      {!loading && items.length === 0 && !error && (
        <p className={styles.empty}>No activities yet. Upload a file above.</p>
      )}

      <div className={styles.list}>
        {items.map((a) => (
          <ActivityCard
            key={a._id}
            activity={a}
            onClick={() => navigate(ROUTES.ACTIVITY_DETAIL.replace(':id', a._id))}
          />
        ))}
      </div>

      {pages >= 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Prev page"
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>{page} of {pages}</span>
          <button
            className={styles.pageBtn}
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
