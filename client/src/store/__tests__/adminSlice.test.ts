import adminReducer, { setMembers, addMember, removeMember, setLoading, setError } from '../adminSlice'
import type { Member } from '../../services/users'

const mockMembers: Member[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin', maxHR: 185, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: '2', name: 'Bob', email: 'bob@example.com', role: 'member', maxHR: 180, createdAt: '2026-01-02T00:00:00.000Z' },
]

const initialState = { members: [], loading: false, error: null }

describe('adminSlice', () => {
  it('returns initial state', () => {
    expect(adminReducer(undefined, { type: '@@INIT' })).toEqual(initialState)
  })

  it('setMembers replaces the members list', () => {
    const state = adminReducer(initialState, setMembers(mockMembers))
    expect(state.members).toEqual(mockMembers)
  })

  it('addMember prepends a new member to the list', () => {
    const loaded = { ...initialState, members: mockMembers }
    const newMember: Member = { id: '3', name: 'Carol', email: 'carol@example.com', role: 'member', maxHR: 190, createdAt: '2026-01-03T00:00:00.000Z' }
    const state = adminReducer(loaded, addMember(newMember))
    expect(state.members).toHaveLength(3)
    expect(state.members[0].id).toBe('3')
  })

  it('removeMember removes the correct member by id', () => {
    const loaded = { ...initialState, members: mockMembers }
    const state = adminReducer(loaded, removeMember('1'))
    expect(state.members).toHaveLength(1)
    expect(state.members[0].id).toBe('2')
  })

  it('setLoading updates loading flag', () => {
    expect(adminReducer(initialState, setLoading(true)).loading).toBe(true)
    expect(adminReducer(initialState, setLoading(false)).loading).toBe(false)
  })

  it('setError updates error message', () => {
    expect(adminReducer(initialState, setError('oops')).error).toBe('oops')
    expect(adminReducer(initialState, setError(null)).error).toBeNull()
  })
})
