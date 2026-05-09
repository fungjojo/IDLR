import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import Admin from '../index'
import authReducer from '../../../store/authSlice'
import adminReducer from '../../../store/adminSlice'
import * as usersService from '../../../services/users'

jest.mock('../../../services/api')
jest.mock('../../../services/users')

const mockedFetchMembers = usersService.fetchMembers as jest.MockedFunction<typeof usersService.fetchMembers>
const mockedDeleteMember = usersService.deleteMember as jest.MockedFunction<typeof usersService.deleteMember>

const mockMembers: usersService.Member[] = [
  { id: 'user-id-1', name: 'Alice', email: 'alice@example.com', role: 'admin', maxHR: 185, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'user-id-2', name: 'Bob', email: 'bob@example.com', role: 'member', maxHR: 180, createdAt: '2026-01-02T00:00:00.000Z' },
]

function renderAdmin(currentUserId = 'user-id-1') {
  const preloadedAuth = {
    user: { id: currentUserId, name: 'Alice', email: 'alice@example.com', role: 'admin' as const, maxHR: 185 },
    loading: false,
    initialized: true,
  }
  const store = configureStore({
    reducer: { auth: authReducer, admin: adminReducer },
    preloadedState: { auth: preloadedAuth },
  })
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <Admin />
        </MemoryRouter>
      </Provider>,
    ),
  }
}

describe('Admin', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows loading state initially', () => {
    mockedFetchMembers.mockImplementation(() => new Promise(() => {}))
    renderAdmin()
    expect(screen.getByText('Loading members…')).toBeInTheDocument()
  })

  it('renders member list after fetch', async () => {
    mockedFetchMembers.mockResolvedValue(mockMembers)
    const { container } = renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(container).toMatchSnapshot()
  })

  it('shows empty state when no members', async () => {
    mockedFetchMembers.mockResolvedValue([])
    renderAdmin()
    await waitFor(() => expect(screen.getByText('No members yet.')).toBeInTheDocument())
  })

  it('shows error message on fetch failure', async () => {
    mockedFetchMembers.mockRejectedValue(new Error('Network error'))
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Failed to load members')).toBeInTheDocument())
  })

  it('does not show delete button for current user row', async () => {
    mockedFetchMembers.mockResolvedValue(mockMembers)
    renderAdmin('user-id-1')
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    expect(deleteButtons).toHaveLength(1)
  })

  it('shows confirm/cancel buttons when delete is clicked', async () => {
    mockedFetchMembers.mockResolvedValue(mockMembers)
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('cancels delete and restores delete button', async () => {
    mockedFetchMembers.mockResolvedValue(mockMembers)
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('removes member from list after confirmed delete', async () => {
    mockedFetchMembers.mockResolvedValue(mockMembers)
    mockedDeleteMember.mockResolvedValue()
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument())
  })

  it('shows error on delete failure', async () => {
    mockedFetchMembers.mockResolvedValue(mockMembers)
    mockedDeleteMember.mockRejectedValue(new Error('Server error'))
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.getByText('Failed to delete member')).toBeInTheDocument())
  })
})
