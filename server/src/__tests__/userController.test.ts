import type { Response } from 'express'
import mongoose from 'mongoose'
import { getUsers, deleteUser } from '../controllers/userController'
import { User } from '../models/User'
import type { AuthRequest } from '../middleware/auth'

jest.mock('../models/User')
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  Types: {
    ObjectId: {
      isValid: jest.fn(),
    },
  },
}))

const mockUsers = [
  {
    _id: { toString: () => 'user-id-1' },
    name: 'Alice',
    email: 'alice@example.com',
    role: 'admin' as const,
    maxHR: 185,
    createdAt: new Date('2026-01-01'),
  },
  {
    _id: { toString: () => 'user-id-2' },
    name: 'Bob',
    email: 'bob@example.com',
    role: 'member' as const,
    maxHR: 180,
    createdAt: new Date('2026-01-02'),
  },
]

function mockRes() {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function adminReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { user: { id: 'user-id-1', role: 'admin' }, params: {}, body: {}, ...overrides } as AuthRequest
}

describe('getUsers', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns list of users without sensitive fields', async () => {
    const sortMock = jest.fn().mockResolvedValue(mockUsers)
    ;(User.find as jest.Mock).mockReturnValue({ sort: sortMock })
    const res = mockRes()
    await getUsers(adminReq(), res)
    expect(User.find).toHaveBeenCalledWith(
      {},
      { passwordHash: 0, stravaAccessToken: 0, stravaRefreshToken: 0, stravaAthleteId: 0 },
    )
    expect(res.json).toHaveBeenCalledWith({
      users: [
        { id: 'user-id-1', name: 'Alice', email: 'alice@example.com', role: 'admin', maxHR: 185, createdAt: mockUsers[0].createdAt },
        { id: 'user-id-2', name: 'Bob', email: 'bob@example.com', role: 'member', maxHR: 180, createdAt: mockUsers[1].createdAt },
      ],
    })
  })

  it('returns 500 on unexpected error', async () => {
    ;(User.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('DB error')) })
    const res = mockRes()
    await getUsers(adminReq(), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Server error' })
  })
})

describe('deleteUser', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when req.user is missing', async () => {
    const req = { params: { id: 'user-id-2' }, body: {} } as unknown as AuthRequest
    const res = mockRes()
    await deleteUser(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorised' })
  })

  it('returns 400 for invalid ObjectId', async () => {
    ;(mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(false)
    const res = mockRes()
    await deleteUser(adminReq({ params: { id: 'bad-id' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid user ID' })
  })

  it('returns 400 when admin tries to delete own account', async () => {
    ;(mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true)
    const res = mockRes()
    await deleteUser(adminReq({ params: { id: 'user-id-1' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Cannot delete your own account' })
  })

  it('returns 404 when user does not exist', async () => {
    ;(mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true)
    ;(User.findByIdAndDelete as jest.Mock).mockResolvedValue(null)
    const res = mockRes()
    await deleteUser(adminReq({ params: { id: 'user-id-2' } }), res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' })
  })

  it('deletes user and returns success message', async () => {
    ;(mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true)
    ;(User.findByIdAndDelete as jest.Mock).mockResolvedValue(mockUsers[1])
    const res = mockRes()
    await deleteUser(adminReq({ params: { id: 'user-id-2' } }), res)
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('user-id-2')
    expect(res.json).toHaveBeenCalledWith({ message: 'User deleted' })
  })

  it('returns 500 on unexpected error', async () => {
    ;(mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true)
    ;(User.findByIdAndDelete as jest.Mock).mockRejectedValue(new Error('DB error'))
    const res = mockRes()
    await deleteUser(adminReq({ params: { id: 'user-id-2' } }), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Server error' })
  })
})
