import api from '../api'
import {
  fetchMembers, deleteMember, createMember, type Member,
} from '../users'

jest.mock('../api')

const mockMember: Member = {
  id: '1',
  name: 'Jojo',
  email: 'jojo@test.com',
  role: 'member',
  maxHR: 185,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('users service', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('fetchMembers', () => {
    it('returns the users list from the response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { users: [mockMember] } })
      const result = await fetchMembers()
      expect(api.get).toHaveBeenCalledWith('/api/users')
      expect(result).toEqual([mockMember])
    })

    it('propagates errors from the API', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('network error'))
      await expect(fetchMembers()).rejects.toThrow('network error')
    })
  })

  describe('deleteMember', () => {
    it('deletes the member by id', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: undefined })
      await deleteMember('1')
      expect(api.delete).toHaveBeenCalledWith('/api/users/1')
    })

    it('propagates errors from the API', async () => {
      (api.delete as jest.Mock).mockRejectedValue(new Error('delete failed'))
      await expect(deleteMember('1')).rejects.toThrow('delete failed')
    })
  })

  describe('createMember', () => {
    it('registers a new member and returns the created user', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: { user: mockMember } })
      const payload = { name: 'Jojo', email: 'jojo@test.com', password: 'password123' }

      const result = await createMember(payload)

      expect(api.post).toHaveBeenCalledWith('/api/auth/register', payload)
      expect(result).toEqual(mockMember)
    })

    it('propagates errors from the API (e.g. duplicate email)', async () => {
      (api.post as jest.Mock).mockRejectedValue(new Error('Email already in use'))
      const payload = { name: 'Jojo', email: 'jojo@test.com', password: 'password123' }
      await expect(createMember(payload)).rejects.toThrow('Email already in use')
    })
  })
})
