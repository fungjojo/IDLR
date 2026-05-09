import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setMembers, removeMember, setLoading, setError } from '../../store/adminSlice'
import { fetchMembers, deleteMember } from '../../services/users'
import styles from './Admin.module.css'

export default function Admin() {
  const dispatch = useAppDispatch()
  const { members, loading, error } = useAppSelector((state) => state.admin)
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Members</h1>
        <p className={styles.subtitle}>Manage team members</p>
      </div>

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
