import api from '../api'
import {
  uploadActivity, fetchActivities, fetchActivity, deleteActivity,
} from '../activities'
import type { Activity, PaginatedActivities } from '../../types/activity'

jest.mock('../api')

const mockActivity: Activity = {
  _id: '1',
  userId: 'u1',
  source: 'manual',
  name: 'Morning Run',
  date: '2026-01-01',
  distanceMeters: 5000,
  durationSeconds: 1800,
  avgHR: 150,
  maxHR: 175,
  hrStream: [],
  paceStream: [],
}

describe('activities service', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('uploadActivity', () => {
    it('posts a FormData payload with an idempotency key header', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockActivity })
      const file = new File(['content'], 'run.gpx')

      const result = await uploadActivity(file)

      expect(api.post).toHaveBeenCalledWith(
        '/api/activities/upload',
        expect.any(FormData),
        expect.objectContaining({ headers: { 'Idempotency-Key': expect.any(String) } }),
      )
      expect(result).toEqual(mockActivity)
    })

    it('uses a different idempotency key on each call', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockActivity })
      const file = new File(['content'], 'run.gpx')

      await uploadActivity(file)
      await uploadActivity(file)

      const [firstCallHeaders, secondCallHeaders] = (api.post as jest.Mock).mock.calls.map(
        (call) => call[2].headers['Idempotency-Key'],
      )
      expect(firstCallHeaders).not.toBe(secondCallHeaders)
    })

    it('propagates errors from the API', async () => {
      (api.post as jest.Mock).mockRejectedValue(new Error('upload failed'))
      const file = new File(['content'], 'run.gpx')

      await expect(uploadActivity(file)).rejects.toThrow('upload failed')
    })
  })

  describe('fetchActivities', () => {
    it('requests the given page and limit', async () => {
      const paginated: PaginatedActivities = {
        activities: [mockActivity], total: 1, page: 2, pages: 1,
      };
      (api.get as jest.Mock).mockResolvedValue({ data: paginated })

      const result = await fetchActivities(2, 10)

      expect(api.get).toHaveBeenCalledWith('/api/activities', { params: { page: 2, limit: 10 } })
      expect(result).toEqual(paginated)
    })

    it('propagates errors from the API', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('network error'))
      await expect(fetchActivities(1, 10)).rejects.toThrow('network error')
    })
  })

  describe('fetchActivity', () => {
    it('requests the activity by id', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockActivity })
      const result = await fetchActivity('1')
      expect(api.get).toHaveBeenCalledWith('/api/activities/1')
      expect(result).toEqual(mockActivity)
    })
  })

  describe('deleteActivity', () => {
    it('deletes the activity by id', async () => {
      (api.delete as jest.Mock).mockResolvedValue({ data: undefined })
      await deleteActivity('1')
      expect(api.delete).toHaveBeenCalledWith('/api/activities/1')
    })

    it('propagates errors from the API', async () => {
      (api.delete as jest.Mock).mockRejectedValue(new Error('delete failed'))
      await expect(deleteActivity('1')).rejects.toThrow('delete failed')
    })
  })
})
