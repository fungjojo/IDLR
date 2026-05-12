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
const mockedCreateMember = usersService.createMember as jest.MockedFunction<typeof usersService.createMember>

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

describe('Admin — invite form', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedFetchMembers.mockResolvedValue(mockMembers)
  })

  it('shows Add Member button and hides form by default', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Add Member' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'New Member' })).not.toBeInTheDocument()
  })

  it('shows form and hides Add Member button when Add Member is clicked', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    expect(screen.queryByRole('button', { name: 'Add Member' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New Member' })).toBeInTheDocument()
  })

  it('hides form and shows Add Member button when Cancel is clicked', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Add Member' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'New Member' })).not.toBeInTheDocument()
  })

  it('shows validation error when required fields are empty', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    expect(screen.getByText('Name, email and password are required')).toBeInTheDocument()
  })

  it('shows validation error when password is too short', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows validation error when Max HR is out of range', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Max HR'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    expect(screen.getByText('Max HR must be between 100 and 250')).toBeInTheDocument()
  })

  it('shows validation error when Max HR field is cleared', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Max HR'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    expect(screen.getByText('Max HR must be between 100 and 250')).toBeInTheDocument()
  })

  it('adds new member to the list and closes form on success (default Max HR)', async () => {
    const newMember: usersService.Member = {
      id: 'user-id-3', name: 'Carol', email: 'carol@example.com', role: 'member', maxHR: 190, createdAt: '2026-01-03T00:00:00.000Z',
    }
    mockedCreateMember.mockResolvedValue(newMember)
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    await waitFor(() => expect(screen.getByText('Carol')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'New Member' })).not.toBeInTheDocument()
    expect(mockedCreateMember).toHaveBeenCalledWith({
      name: 'Carol', email: 'carol@example.com', password: 'password123', maxHR: 190,
    })
  })

  it('submits with a non-default Max HR value', async () => {
    const newMember: usersService.Member = {
      id: 'user-id-3', name: 'Carol', email: 'carol@example.com', role: 'member', maxHR: 175, createdAt: '2026-01-03T00:00:00.000Z',
    }
    mockedCreateMember.mockResolvedValue(newMember)
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Max HR'), { target: { value: '175' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    await waitFor(() => expect(screen.getByText('Carol')).toBeInTheDocument())
    expect(mockedCreateMember).toHaveBeenCalledWith({
      name: 'Carol', email: 'carol@example.com', password: 'password123', maxHR: 175,
    })
  })

  it('shows email-in-use error on 409 response', async () => {
    mockedCreateMember.mockRejectedValue({ response: { status: 409 } })
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    await waitFor(() => expect(screen.getByText('Email already in use')).toBeInTheDocument())
  })

  it('shows server error message from response body on 4xx', async () => {
    mockedCreateMember.mockRejectedValue({ response: { status: 400, data: { message: 'Password must be at least 8 characters' } } })
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    await waitFor(() => expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument())
  })

  it('shows generic error when no response body message', async () => {
    mockedCreateMember.mockRejectedValue(new Error('Network error'))
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Carol' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Member' }))
    await waitFor(() => expect(screen.getByText('Failed to create member')).toBeInTheDocument())
  })
})
