import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setMembers, addMember, removeMember, setLoading, setError } from '../../store/adminSlice'
import { fetchMembers, deleteMember, createMember } from '../../services/users'
import styles from './Admin.module.css'

const DEFAULT_MAX_HR = 190
const MIN_PASSWORD_LENGTH = 8

interface FormState {
  name: string
  email: string
  password: string
  maxHR: number | ''
}

const EMPTY_FORM: FormState = { name: '', email: '', password: '', maxHR: DEFAULT_MAX_HR }

export default function Admin() {
  const dispatch = useAppDispatch()
  const { members, loading, error } = useAppSelector((state) => state.admin)
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      dispatch(setLoading(true))
      dispatch(setError(null))
      try {
        const data = await fetchMembers()
        dispatch(setMembers(data))
      } catch {
        dispatch(setError('Failed to load members'))
      } finally {
        dispatch(setLoading(false))
      }
    }
    load()
  }, [dispatch])

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteMember(id)
      dispatch(removeMember(id))
      setConfirmDeleteId(null)
    } catch {
      dispatch(setError('Failed to delete member'))
    } finally {
      setDeleting(false)
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const handleCancelForm = () => {
    resetForm()
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError('Name, email and password are required')
      return
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setFormError('Password must be at least 8 characters')
      return
    }
    const maxHR = form.maxHR === '' ? NaN : form.maxHR
    if (isNaN(maxHR) || maxHR < 100 || maxHR > 250) {
      setFormError('Max HR must be between 100 and 250')
      return
    }

    setSubmitting(true)
    try {
      const member = await createMember({ name: form.name.trim(), email: form.email.trim(), password: form.password, maxHR })
      dispatch(addMember(member))
      resetForm()
      setShowForm(false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 409) {
        setFormError('Email already in use')
      } else if (message) {
        setFormError(message)
      } else {
        setFormError('Failed to create member')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Members</h1>
          <p className={styles.subtitle}>Manage team members</p>
        </div>
        {!showForm && (
          <button className={styles.addButton} onClick={() => setShowForm(true)}>
            Add Member
          </button>
        )}
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h2 className={styles.formTitle}>New Member</h2>
          {formError && <p className={styles.error}>{formError}</p>}
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="member-name">Name</label>
              <input
                id="member-name"
                className={styles.input}
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                disabled={submitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="member-email">Email</label>
              <input
                id="member-email"
                className={styles.input}
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                disabled={submitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="member-password">Password</label>
              <input
                id="member-password"
                className={styles.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                disabled={submitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="member-maxhr">Max HR</label>
              <input
                id="member-maxhr"
                className={styles.input}
                type="number"
                value={form.maxHR}
                onChange={(e) => setForm((f) => ({ ...f, maxHR: e.target.value === '' ? '' : Number(e.target.value) }))}
                min={100}
                max={250}
                disabled={submitting}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Member'}
            </button>
            <button type="button" className={styles.cancelButton} onClick={handleCancelForm} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.loading}>Loading members…</p>
      ) : members.length === 0 ? (
        <p className={styles.empty}>No members yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Max HR</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>
                  <span className={`${styles.badge} ${member.role === 'admin' ? styles.badgeAdmin : styles.badgeMember}`}>
                    {member.role}
                  </span>
                </td>
                <td>{member.maxHR}</td>
                <td>
                  {currentUserId !== member.id && (
                    <div className={styles.actions}>
                      {confirmDeleteId === member.id ? (
                        <>
                          <button
                            className={styles.confirmButton}
                            onClick={() => handleDelete(member.id)}
                            disabled={deleting}
                          >
                            Confirm
                          </button>
                          <button
                            className={styles.cancelButton}
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deleting}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.deleteButton}
                          onClick={() => setConfirmDeleteId(member.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
