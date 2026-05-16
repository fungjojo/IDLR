import activitiesReducer, {
  fetchActivitiesThunk,
  fetchActivityThunk,
  deleteActivityThunk,
  setActivities,
  setSelected,
  setLoading,
  setError,
  removeActivity,
  type ActivitiesState,
} from '../activitiesSlice'
import type { Activity, PaginatedActivities } from '../../types/activity'

jest.mock('../../services/activities', () => ({
  fetchActivities: jest.fn(),
  fetchActivity: jest.fn(),
  deleteActivity: jest.fn(),
}))

import * as activitiesService from '../../services/activities'
const mockFetchActivities = activitiesService.fetchActivities as jest.MockedFunction<typeof activitiesService.fetchActivities>
const mockFetchActivity = activitiesService.fetchActivity as jest.MockedFunction<typeof activitiesService.fetchActivity>
const mockDeleteActivity = activitiesService.deleteActivity as jest.MockedFunction<typeof activitiesService.deleteActivity>

const mockActivity: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  source: 'manual',
  name: 'Morning Run',
  date: '2026-05-16T08:00:00.000Z',
  distanceMeters: 8200,
  durationSeconds: 2535,
  avgHR: 158,
  maxHR: 178,
  hrStream: [140, 145, 150],
  paceStream: [300, 310, 320],
}

const mockPaginated: PaginatedActivities = {
  activities: [mockActivity],
  total: 1,
  page: 1,
  pages: 1,
}

const initialState: ActivitiesState = {
  items: [],
  selected: null,
  total: 0,
  page: 1,
  pages: 0,
  loading: false,
  error: null,
}

import { configureStore } from '@reduxjs/toolkit'

function makeStore(preloaded?: Partial<ActivitiesState>) {
  return configureStore({
    reducer: { activities: activitiesReducer },
    preloadedState: preloaded ? { activities: { ...initialState, ...preloaded } } : undefined,
  })
}

describe('activitiesSlice reducers', () => {
  it('setActivities replaces items', () => {
    const state = activitiesReducer(initialState, setActivities([mockActivity]))
    expect(state.items).toEqual([mockActivity])
  })

  it('setSelected sets selected activity', () => {
    const state = activitiesReducer(initialState, setSelected(mockActivity))
    expect(state.selected).toEqual(mockActivity)
  })

  it('setLoading updates loading flag', () => {
    const state = activitiesReducer(initialState, setLoading(true))
    expect(state.loading).toBe(true)
  })

  it('setError sets error message', () => {
    const state = activitiesReducer(initialState, setError('oops'))
    expect(state.error).toBe('oops')
  })

  it('removeActivity filters item by id', () => {
    const state = activitiesReducer(
      { ...initialState, items: [mockActivity] },
      removeActivity('act-1'),
    )
    expect(state.items).toHaveLength(0)
  })
})

describe('fetchActivitiesThunk', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets loading true while pending', () => {
    mockFetchActivities.mockReturnValue(new Promise(() => {}))
    const store = makeStore()
    store.dispatch(fetchActivitiesThunk({ page: 1, limit: 10 }))
    expect(store.getState().activities.loading).toBe(true)
  })

  it('populates items on fulfilled', async () => {
    mockFetchActivities.mockResolvedValue(mockPaginated)
    const store = makeStore()
    await store.dispatch(fetchActivitiesThunk({ page: 1, limit: 10 }))
    const { items, total, page, pages, loading } = store.getState().activities
    expect(items).toEqual([mockActivity])
    expect(total).toBe(1)
    expect(page).toBe(1)
    expect(pages).toBe(1)
    expect(loading).toBe(false)
  })

  it('sets error on rejected', async () => {
    mockFetchActivities.mockRejectedValue(new Error('network error'))
    const store = makeStore()
    await store.dispatch(fetchActivitiesThunk({ page: 1, limit: 10 }))
    expect(store.getState().activities.error).toBe('network error')
    expect(store.getState().activities.loading).toBe(false)
  })
})

describe('fetchActivityThunk', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets selected on fulfilled', async () => {
    mockFetchActivity.mockResolvedValue(mockActivity)
    const store = makeStore()
    await store.dispatch(fetchActivityThunk('act-1'))
    expect(store.getState().activities.selected).toEqual(mockActivity)
    expect(store.getState().activities.loading).toBe(false)
  })

  it('sets error on rejected', async () => {
    mockFetchActivity.mockRejectedValue(new Error('not found'))
    const store = makeStore()
    await store.dispatch(fetchActivityThunk('bad-id'))
    expect(store.getState().activities.error).toBe('not found')
  })
})

describe('deleteActivityThunk', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets loading true while pending', () => {
    mockDeleteActivity.mockReturnValue(new Promise(() => {}))
    const store = makeStore()
    store.dispatch(deleteActivityThunk('act-1'))
    expect(store.getState().activities.loading).toBe(true)
  })

  it('removes item from list on fulfilled', async () => {
    mockDeleteActivity.mockResolvedValue(undefined)
    const store = makeStore({ items: [mockActivity] })
    await store.dispatch(deleteActivityThunk('act-1'))
    expect(store.getState().activities.items).toHaveLength(0)
    expect(store.getState().activities.loading).toBe(false)
  })

  it('clears selected if it matches deleted id', async () => {
    mockDeleteActivity.mockResolvedValue(undefined)
    const store = makeStore({ items: [mockActivity], selected: mockActivity })
    await store.dispatch(deleteActivityThunk('act-1'))
    expect(store.getState().activities.selected).toBeNull()
  })

  it('sets error on rejected', async () => {
    mockDeleteActivity.mockRejectedValue(new Error('delete failed'))
    const store = makeStore({ items: [mockActivity] })
    await store.dispatch(deleteActivityThunk('act-1'))
    expect(store.getState().activities.error).toBe('delete failed')
    expect(store.getState().activities.loading).toBe(false)
    expect(store.getState().activities.items).toHaveLength(1)
  })
})
