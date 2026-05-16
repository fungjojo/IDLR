# Activity List + Detail Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 7 — server endpoints for listing/viewing/deleting activities, Redux thunks, `ActivityCard`/`StatCard`/`HRChart` components, and fully working Activities + ActivityDetail screens.

**Architecture:** Server adds three new endpoints (`GET /api/activities`, `GET /api/activities/:id`, `DELETE /api/activities/:id`) behind existing auth middleware. Client extends `activitiesSlice` with `createAsyncThunk` for each, adds three reusable components, updates the Activities screen with a paginated list, and builds ActivityDetail from scratch. A shared `types/activity.ts` eliminates type duplication between service and slice.

**Tech Stack:** Express + Mongoose (server), React 18 + Vite + TypeScript + Redux Toolkit + React Router v6 + Recharts (client), Jest + Testing Library (tests)

---

## File Map

**New files:**
- `client/src/types/activity.ts` — canonical `Activity` + `PaginatedActivities` types
- `client/src/store/__tests__/activitiesSlice.test.ts` — thunk unit tests
- `client/src/components/StatCard/index.tsx`
- `client/src/components/StatCard/StatCard.module.css`
- `client/src/components/StatCard/__tests__/StatCard.test.tsx`
- `client/src/components/ActivityCard/index.tsx`
- `client/src/components/ActivityCard/ActivityCard.module.css`
- `client/src/components/ActivityCard/__tests__/ActivityCard.test.tsx`
- `client/src/components/HRChart/index.tsx`
- `client/src/components/HRChart/HRChart.module.css`
- `client/src/components/HRChart/__tests__/HRChart.test.tsx`
- `client/src/screens/ActivityDetail/ActivityDetail.module.css`
- `client/src/screens/ActivityDetail/__tests__/ActivityDetail.test.tsx`

**Modified files:**
- `client/src/services/activities.ts` — import shared type, add fetch/delete functions
- `client/src/store/activitiesSlice.ts` — import shared type, extend state, add thunks
- `client/src/screens/Activities/index.tsx` — add list + pagination, wire Redux
- `client/src/screens/Activities/Activities.module.css` — add list/pagination styles
- `client/src/screens/Activities/__tests__/Activities.test.tsx` — add Redux wrapper + new tests
- `client/src/screens/ActivityDetail/index.tsx` — full implementation replacing placeholder
- `server/src/controllers/activitiesController.ts` — add getActivities, getActivity, deleteActivity
- `server/src/routes/activities.ts` — register new routes
- `server/src/__tests__/activitiesController.test.ts` — add tests for new controllers

---

## Task 1: Create branch + shared Activity type

**Files:**
- Create: `client/src/types/activity.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout -b add-activity-list-detail
```

- [ ] **Step 2: Create the shared type file**

Create `client/src/types/activity.ts`:

```typescript
export interface Activity {
  _id: string
  userId: string
  source: 'strava' | 'manual'
  name: string
  date: string
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  hrStream: number[]
  paceStream: number[]
  cadenceAvg?: number
  elevationGainMeters?: number
}

export interface PaginatedActivities {
  activities: Activity[]
  total: number
  page: number
  pages: number
}
```

---

## Task 2: Service layer

**Files:**
- Modify: `client/src/services/activities.ts`

- [ ] **Step 1: Replace the file contents**

Replace `client/src/services/activities.ts` with:

```typescript
import api from './api'
import type { Activity, PaginatedActivities } from '../types/activity'

export type { Activity, PaginatedActivities }

export async function uploadActivity(file: File): Promise<Activity> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<Activity>('/api/activities/upload', formData, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })
  return response.data
}

export async function fetchActivities(page: number, limit: number): Promise<PaginatedActivities> {
  const response = await api.get<PaginatedActivities>('/api/activities', {
    params: { page, limit },
  })
  return response.data
}

export async function fetchActivity(id: string): Promise<Activity> {
  const response = await api.get<Activity>(`/api/activities/${id}`)
  return response.data
}

export async function deleteActivity(id: string): Promise<void> {
  await api.delete(`/api/activities/${id}`)
}
```

---

## Task 3: activitiesSlice — write failing tests

**Files:**
- Create: `client/src/store/__tests__/activitiesSlice.test.ts`

- [ ] **Step 1: Create the test file**

Create `client/src/store/__tests__/activitiesSlice.test.ts`:

```typescript
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

  it('removes item from list on fulfilled', async () => {
    mockDeleteActivity.mockResolvedValue(undefined)
    const store = makeStore({ items: [mockActivity] })
    await store.dispatch(deleteActivityThunk('act-1'))
    expect(store.getState().activities.items).toHaveLength(0)
  })

  it('clears selected if it matches deleted id', async () => {
    mockDeleteActivity.mockResolvedValue(undefined)
    const store = makeStore({ items: [mockActivity], selected: mockActivity })
    await store.dispatch(deleteActivityThunk('act-1'))
    expect(store.getState().activities.selected).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd client && npm test -- --testPathPattern=activitiesSlice --no-coverage
```

Expected: **FAIL** — `fetchActivitiesThunk`, `fetchActivityThunk`, `deleteActivityThunk`, and `ActivitiesState` are not exported yet.

---

## Task 4: activitiesSlice — implement thunks

**Files:**
- Modify: `client/src/store/activitiesSlice.ts`

- [ ] **Step 1: Replace the file contents**

Replace `client/src/store/activitiesSlice.ts` with:

```typescript
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { fetchActivities, fetchActivity, deleteActivity } from '../services/activities'
import type { Activity, PaginatedActivities } from '../types/activity'

export type { Activity }

export interface ActivitiesState {
  items: Activity[]
  selected: Activity | null
  total: number
  page: number
  pages: number
  loading: boolean
  error: string | null
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

export const fetchActivitiesThunk = createAsyncThunk<
  PaginatedActivities,
  { page: number; limit: number }
>('activities/fetchActivities', ({ page, limit }) => fetchActivities(page, limit))

export const fetchActivityThunk = createAsyncThunk<Activity, string>(
  'activities/fetchActivity',
  (id) => fetchActivity(id),
)

export const deleteActivityThunk = createAsyncThunk<string, string>(
  'activities/deleteActivity',
  async (id) => {
    await deleteActivity(id)
    return id
  },
)

const activitiesSlice = createSlice({
  name: 'activities',
  initialState,
  reducers: {
    setActivities(state, action: PayloadAction<Activity[]>) {
      state.items = action.payload
    },
    setSelected(state, action: PayloadAction<Activity>) {
      state.selected = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    removeActivity(state, action: PayloadAction<string>) {
      state.items = state.items.filter((a) => a._id !== action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivitiesThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchActivitiesThunk.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.activities
        state.total = action.payload.total
        state.page = action.payload.page
        state.pages = action.payload.pages
      })
      .addCase(fetchActivitiesThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch activities'
      })
      .addCase(fetchActivityThunk.pending, (state) => {
        state.loading = true
        state.error = null
        state.selected = null
      })
      .addCase(fetchActivityThunk.fulfilled, (state, action) => {
        state.loading = false
        state.selected = action.payload
      })
      .addCase(fetchActivityThunk.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch activity'
      })
      .addCase(deleteActivityThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((a) => a._id !== action.payload)
        if (state.selected?._id === action.payload) {
          state.selected = null
        }
      })
  },
})

export const { setActivities, setSelected, setLoading, setError, removeActivity } =
  activitiesSlice.actions
export default activitiesSlice.reducer
```

- [ ] **Step 2: Run tests and confirm they pass**

```bash
cd client && npm test -- --testPathPattern=activitiesSlice --no-coverage
```

Expected: **PASS** — all reducer and thunk tests green.

- [ ] **Step 3: Commit**

```bash
git add client/src/types/activity.ts client/src/services/activities.ts client/src/store/activitiesSlice.ts client/src/store/__tests__/activitiesSlice.test.ts
git commit -m "$(cat <<'EOF'
Add shared Activity type, service functions, and activitiesSlice thunks (Step 7b)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Server — write failing controller tests

**Files:**
- Modify: `server/src/__tests__/activitiesController.test.ts`

- [ ] **Step 1: Replace the test file with the full updated version**

Replace `server/src/__tests__/activitiesController.test.ts`:

```typescript
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import {
  uploadActivity,
  getActivities,
  getActivity,
  deleteActivity,
} from '../controllers/activitiesController'

const mockCreate = jest.fn()
const mockFind = jest.fn()
const mockFindById = jest.fn()
const mockCountDocuments = jest.fn()

jest.mock('../models/Activity', () => ({
  Activity: {
    create: (...args: unknown[]) => mockCreate(...args),
    find: (...args: unknown[]) => mockFind(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
  },
}))

const mockParseFit = jest.fn()
const mockParseGpx = jest.fn()
jest.mock('../services/fitParser', () => ({ parseFitBuffer: (...args: unknown[]) => mockParseFit(...args) }))
jest.mock('../services/gpxParser', () => ({ parseGpxBuffer: (...args: unknown[]) => mockParseGpx(...args) }))

const ACTIVITY_DATA = {
  name: 'Morning Run',
  date: new Date('2024-03-01'),
  distanceMeters: 5000,
  durationSeconds: 1800,
  avgHR: 145,
  maxHR: 175,
  hrStream: [140, 145, 150],
  paceStream: [333, 312, 322],
}

const MOCK_ACTIVITY_DOC = {
  _id: 'act-1',
  userId: { toString: () => 'user123' },
  ...ACTIVITY_DATA,
  deleteOne: jest.fn().mockResolvedValue({}),
}

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    user: { id: 'user123', email: 'test@test.com', role: 'member' },
    file: {
      fieldname: 'file',
      originalname: 'run.gpx',
      mimetype: 'application/gpx+xml',
      buffer: Buffer.from('<gpx/>'),
      size: 10,
    } as Express.Multer.File,
    query: {},
    params: {},
    ...overrides,
  } as AuthRequest
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// ── uploadActivity (existing) ──────────────────────────────────────────────

describe('uploadActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when no file provided', async () => {
    const req = makeReq({ file: undefined })
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'No file provided' })
  })

  it('returns 400 for unsupported file extension', async () => {
    const req = makeReq({ file: { originalname: 'data.csv' } as Express.Multer.File })
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('fit') }))
  })

  it('calls parseGpxBuffer for .gpx files and saves activity', async () => {
    mockParseGpx.mockReturnValue(ACTIVITY_DATA)
    mockCreate.mockResolvedValue({ _id: 'act1', ...ACTIVITY_DATA })
    const req = makeReq()
    const res = makeRes()
    await uploadActivity(req, res)
    expect(mockParseGpx).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual', userId: 'user123' }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('calls parseFitBuffer for .fit files', async () => {
    mockParseFit.mockResolvedValue(ACTIVITY_DATA)
    mockCreate.mockResolvedValue({ _id: 'act1', ...ACTIVITY_DATA })
    const req = makeReq({ file: { originalname: 'run.fit', buffer: Buffer.from('') } as Express.Multer.File })
    const res = makeRes()
    await uploadActivity(req, res)
    expect(mockParseFit).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('returns 422 when parser throws', async () => {
    mockParseGpx.mockImplementation(() => { throw new Error('parse error') })
    const req = makeReq()
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(422)
  })

  it('returns 500 when Activity.create throws', async () => {
    mockParseGpx.mockReturnValue(ACTIVITY_DATA)
    mockCreate.mockRejectedValue(new Error('db error'))
    const req = makeReq()
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

// ── getActivities ──────────────────────────────────────────────────────────

describe('getActivities', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeChain(result: unknown[]) {
    return {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(result),
    }
  }

  it('returns paginated activities for the current user', async () => {
    mockFind.mockReturnValue(makeChain([MOCK_ACTIVITY_DOC]))
    mockCountDocuments.mockResolvedValue(1)
    const req = makeReq({ query: { page: '1', limit: '10' } })
    const res = makeRes()
    await getActivities(req, res)
    expect(mockFind).toHaveBeenCalledWith({ userId: 'user123' })
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      activities: [MOCK_ACTIVITY_DOC],
      total: 1,
      page: 1,
      pages: 1,
    }))
  })

  it('defaults to page 1 and limit 10 when query params are missing', async () => {
    mockFind.mockReturnValue(makeChain([]))
    mockCountDocuments.mockResolvedValue(0)
    const req = makeReq({ query: {} })
    const res = makeRes()
    await getActivities(req, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pages: 0 }))
  })

  it('returns 500 on database error', async () => {
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(new Error('db error')),
    })
    mockCountDocuments.mockResolvedValue(0)
    const req = makeReq({ query: {} })
    const res = makeRes()
    await getActivities(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

// ── getActivity ────────────────────────────────────────────────────────────

describe('getActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the activity when found and owned by user', async () => {
    mockFindById.mockResolvedValue(MOCK_ACTIVITY_DOC)
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await getActivity(req, res)
    expect(res.json).toHaveBeenCalledWith(MOCK_ACTIVITY_DOC)
  })

  it('returns 404 when activity does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    const req = makeReq({ params: { id: 'bad-id' } })
    const res = makeRes()
    await getActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 404 when activity belongs to another user', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_ACTIVITY_DOC,
      userId: { toString: () => 'other-user' },
    })
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await getActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

// ── deleteActivity ─────────────────────────────────────────────────────────

describe('deleteActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes the activity and returns 204', async () => {
    const mockDoc = { ...MOCK_ACTIVITY_DOC, deleteOne: jest.fn().mockResolvedValue({}) }
    mockFindById.mockResolvedValue(mockDoc)
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await deleteActivity(req, res)
    expect(mockDoc.deleteOne).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('returns 404 when activity does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    const req = makeReq({ params: { id: 'bad-id' } })
    const res = makeRes()
    await deleteActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 404 when activity belongs to another user', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_ACTIVITY_DOC,
      userId: { toString: () => 'other-user' },
      deleteOne: jest.fn(),
    })
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await deleteActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
```

- [ ] **Step 2: Run and confirm they fail**

```bash
cd server && npm test -- --testPathPattern=activitiesController --no-coverage
```

Expected: **FAIL** — `getActivities`, `getActivity`, `deleteActivity` not exported yet.

---

## Task 6: Server — implement controllers + routes

**Files:**
- Modify: `server/src/controllers/activitiesController.ts`
- Modify: `server/src/routes/activities.ts`

- [ ] **Step 1: Add three controller functions**

Append to the bottom of `server/src/controllers/activitiesController.ts` (keep `uploadActivity` unchanged):

```typescript
export async function getActivities(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10)))
  const skip = (page - 1) * limit

  try {
    const [activities, total] = await Promise.all([
      Activity.find({ userId: req.user!.id }).sort({ date: -1 }).skip(skip).limit(limit),
      Activity.countDocuments({ userId: req.user!.id }),
    ])
    const pages = Math.ceil(total / limit)
    res.json({ activities, total, page, pages })
  } catch (err) {
    logger.error({ err }, 'Failed to fetch activities')
    res.status(500).json({ message: 'Server error' })
  }
}

export async function getActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const activity = await Activity.findById(req.params.id)
    if (!activity || activity.userId.toString() !== req.user!.id) {
      res.status(404).json({ message: 'Activity not found' })
      return
    }
    res.json(activity)
  } catch (err) {
    logger.error({ err }, 'Failed to fetch activity')
    res.status(500).json({ message: 'Server error' })
  }
}

export async function deleteActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const activity = await Activity.findById(req.params.id)
    if (!activity || activity.userId.toString() !== req.user!.id) {
      res.status(404).json({ message: 'Activity not found' })
      return
    }
    await activity.deleteOne()
    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'Failed to delete activity')
    res.status(500).json({ message: 'Server error' })
  }
}
```

- [ ] **Step 2: Register the new routes**

Replace `server/src/routes/activities.ts` with:

```typescript
import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import {
  uploadActivity,
  getActivities,
  getActivity,
  deleteActivity,
} from '../controllers/activitiesController'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase()
    cb(null, ext === 'fit' || ext === 'gpx')
  },
})

router.get('/', requireAuth, getActivities)
router.get('/:id', requireAuth, getActivity)
router.delete('/:id', requireAuth, deleteActivity)
router.post('/upload', requireAuth, idempotency, upload.single('file'), uploadActivity)

export default router
```

- [ ] **Step 3: Run server tests and confirm they pass**

```bash
cd server && npm test -- --testPathPattern=activitiesController --no-coverage
```

Expected: **PASS**

- [ ] **Step 4: Run full server test suite**

```bash
cd server && npm test --no-coverage
```

Expected: **PASS** — all existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/activitiesController.ts server/src/routes/activities.ts server/src/__tests__/activitiesController.test.ts
git commit -m "$(cat <<'EOF'
Add GET /api/activities, GET /api/activities/:id, DELETE /api/activities/:id (Step 7a)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: StatCard component

**Files:**
- Create: `client/src/components/StatCard/index.tsx`
- Create: `client/src/components/StatCard/StatCard.module.css`
- Create: `client/src/components/StatCard/__tests__/StatCard.test.tsx`

- [ ] **Step 1: Write the failing snapshot test**

Create `client/src/components/StatCard/__tests__/StatCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import StatCard from '../index'

describe('StatCard', () => {
  it('matches snapshot without accent', () => {
    const { asFragment } = render(<StatCard label="Distance" value="8.2 km" />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('matches snapshot with accent color', () => {
    const { asFragment } = render(<StatCard label="Avg HR" value="158 bpm" accentColor="#dc2626" />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders label and value', () => {
    render(<StatCard label="Time" value="42:15" />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('42:15')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and confirm fail**

```bash
cd client && npm test -- --testPathPattern=StatCard --no-coverage
```

Expected: **FAIL** — cannot find module `../index`.

- [ ] **Step 3: Create the component**

Create `client/src/components/StatCard/index.tsx`:

```typescript
import styles from './StatCard.module.css'

interface StatCardProps {
  label: string
  value: string
  accentColor?: string
}

export default function StatCard({ label, value, accentColor }: StatCardProps) {
  const style = accentColor ? ({ '--accent': accentColor } as React.CSSProperties) : undefined

  return (
    <div className={styles.card} style={style}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  )
}
```

Create `client/src/components/StatCard/StatCard.module.css`:

```css
.card {
  background: #ffffff;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border-left: 3px solid var(--accent, transparent);
  flex: 1;
}

.label {
  display: block;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--accent, #1e293b);
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd client && npm test -- --testPathPattern=StatCard --no-coverage
```

Expected: **PASS**

---

## Task 8: ActivityCard component

**Files:**
- Create: `client/src/components/ActivityCard/index.tsx`
- Create: `client/src/components/ActivityCard/ActivityCard.module.css`
- Create: `client/src/components/ActivityCard/__tests__/ActivityCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/ActivityCard/__tests__/ActivityCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import ActivityCard from '../index'
import type { Activity } from '../../../types/activity'

const mockActivity: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  source: 'strava',
  name: 'Morning Run',
  date: '2026-05-16T08:00:00.000Z',
  distanceMeters: 8200,
  durationSeconds: 2535,
  avgHR: 158,
  maxHR: 178,
  hrStream: [],
  paceStream: [],
}

describe('ActivityCard', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(<ActivityCard activity={mockActivity} onClick={jest.fn()} />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders activity name', () => {
    render(<ActivityCard activity={mockActivity} onClick={jest.fn()} />)
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
  })

  it('renders distance and avg HR', () => {
    render(<ActivityCard activity={mockActivity} onClick={jest.fn()} />)
    expect(screen.getByText(/8\.20 km/)).toBeInTheDocument()
    expect(screen.getByText(/158/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    render(<ActivityCard activity={mockActivity} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick on Enter keydown', () => {
    const onClick = jest.fn()
    render(<ActivityCard activity={mockActivity} onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run and confirm fail**

```bash
cd client && npm test -- --testPathPattern=ActivityCard --no-coverage
```

Expected: **FAIL**

- [ ] **Step 3: Create the component**

Create `client/src/components/ActivityCard/index.tsx`:

```typescript
import type { Activity } from '../../types/activity'
import styles from './ActivityCard.module.css'

interface ActivityCardProps {
  activity: Activity
  onClick: () => void
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ActivityCard({ activity, onClick }: ActivityCardProps) {
  const date = new Date(activity.date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div
      className={styles.card}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.header}>
        <p className={styles.name}>{activity.name}</p>
        <p className={styles.meta}>
          {date}
          {' · '}
          <span className={styles.source}>{activity.source}</span>
        </p>
      </div>
      <div className={styles.stats}>
        <span className={styles.stat}>{formatDistance(activity.distanceMeters)}</span>
        <span className={styles.sep}>·</span>
        <span className={styles.stat}>{formatDuration(activity.durationSeconds)}</span>
        <span className={styles.sep}>·</span>
        <span className={`${styles.stat} ${styles.hrAvg}`}>♥ {activity.avgHR} avg</span>
        <span className={styles.sep}>·</span>
        <span className={`${styles.stat} ${styles.hrMax}`}>♥ {activity.maxHR} max</span>
      </div>
    </div>
  )
}
```

Create `client/src/components/ActivityCard/ActivityCard.module.css`:

```css
.card {
  position: relative;
  background: #ffffff;
  border-radius: 8px;
  padding: 12px 12px 12px 18px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  outline: none;
  transition: box-shadow 0.15s;
}

.card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(to bottom, #dc2626, #f97316);
  border-radius: 8px 0 0 8px;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card:focus-visible {
  box-shadow: 0 0 0 2px #6366f1;
}

.header {
  margin-bottom: 6px;
}

.name {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 2px;
}

.meta {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.source {
  color: #6366f1;
  font-weight: 600;
}

.stats {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.stat {
  font-size: 13px;
  color: #475569;
}

.sep {
  color: #cbd5e1;
  font-size: 12px;
}

.hrAvg {
  color: #dc2626;
  font-weight: 600;
}

.hrMax {
  color: #f97316;
  font-weight: 600;
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
cd client && npm test -- --testPathPattern=ActivityCard --no-coverage
```

Expected: **PASS**

- [ ] **Step 5: Commit components so far**

```bash
git add client/src/components/StatCard client/src/components/ActivityCard
git commit -m "$(cat <<'EOF'
Add StatCard and ActivityCard components (Step 7c/7d)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: HRChart component

**Files:**
- Create: `client/src/components/HRChart/index.tsx`
- Create: `client/src/components/HRChart/HRChart.module.css`
- Create: `client/src/components/HRChart/__tests__/HRChart.test.tsx`

- [ ] **Step 1: Install Recharts**

```bash
cd client && npm install recharts
```

- [ ] **Step 2: Write the failing test**

Create `client/src/components/HRChart/__tests__/HRChart.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import HRChart from '../index'

// ResponsiveContainer needs a real DOM with dimensions — mock it in tests
jest.mock('recharts', () => {
  const actual = jest.requireActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="chart-container" style={{ width: 600, height: 200 }}>
        {children}
      </div>
    ),
  }
})

const HR_STREAM = [140, 145, 150, 155, 160, 158, 155, 152, 148, 145]

describe('HRChart', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(
      <HRChart hrStream={HR_STREAM} durationSeconds={600} />,
    )
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders the chart container', () => {
    render(<HRChart hrStream={HR_STREAM} durationSeconds={600} />)
    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run and confirm fail**

```bash
cd client && npm test -- --testPathPattern=HRChart --no-coverage
```

Expected: **FAIL**

- [ ] **Step 4: Create the component**

Create `client/src/components/HRChart/index.tsx`:

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import styles from './HRChart.module.css'

interface HRChartProps {
  hrStream: number[]
  durationSeconds: number
}

export default function HRChart({ hrStream, durationSeconds }: HRChartProps) {
  const data = hrStream.map((bpm, i) => ({
    t: Math.round((i / Math.max(hrStream.length - 1, 1)) * (durationSeconds / 60) * 10) / 10,
    bpm,
  }))

  return (
    <div className={styles.container}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="t"
            unit=" min"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            unit=" bpm"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v} bpm`, 'HR']}
            labelFormatter={(l: number) => `${l} min`}
          />
          <Line
            type="monotone"
            dataKey="bpm"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#dc2626' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

Create `client/src/components/HRChart/HRChart.module.css`:

```css
.container {
  background: #ffffff;
  border-radius: 8px;
  padding: 12px 4px 12px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd client && npm test -- --testPathPattern=HRChart --no-coverage
```

Expected: **PASS**

- [ ] **Step 6: Commit HRChart**

```bash
git add client/src/components/HRChart
git commit -m "$(cat <<'EOF'
Add HRChart component with Recharts (Step 7e)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Activities screen — list + pagination

**Files:**
- Modify: `client/src/screens/Activities/index.tsx`
- Modify: `client/src/screens/Activities/Activities.module.css`
- Modify: `client/src/screens/Activities/__tests__/Activities.test.tsx`

- [ ] **Step 1: Update the test file first**

Replace `client/src/screens/Activities/__tests__/Activities.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Activities from '../index'
import * as activitiesService from '../../../services/activities'
import type { Activity } from '../../../types/activity'

jest.mock('../../../services/api')
jest.mock('../../../services/activities')

const mockDispatch = jest.fn().mockReturnValue(Promise.resolve({ payload: undefined }))

jest.mock('../../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}))

jest.mock('../../../store/activitiesSlice', () => ({
  fetchActivitiesThunk: jest.fn((args: unknown) => ({
    type: 'activities/fetchActivities/pending',
    payload: args,
  })),
}))

import { useAppSelector } from '../../../store/hooks'
const mockUseAppSelector = useAppSelector as jest.Mock

const mockedUpload = activitiesService.uploadActivity as jest.MockedFunction<
  typeof activitiesService.uploadActivity
>

const MOCK_ACTIVITY: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  name: 'Morning Run',
  date: '2024-03-01T08:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1800,
  avgHR: 145,
  maxHR: 175,
  source: 'manual',
  hrStream: [],
  paceStream: [],
}

const DEFAULT_STATE = {
  items: [],
  loading: false,
  error: null,
  page: 1,
  pages: 0,
}

function renderScreen(stateOverrides = {}) {
  mockUseAppSelector.mockReturnValue({ ...DEFAULT_STATE, ...stateOverrides })
  return render(
    <MemoryRouter>
      <Activities />
    </MemoryRouter>,
  )
}

describe('Activities screen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('matches snapshot', () => {
    const { asFragment } = renderScreen()
    expect(asFragment()).toMatchSnapshot()
  })

  it('dispatches fetchActivitiesThunk on mount', () => {
    renderScreen()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'activities/fetchActivities/pending' }),
    )
  })

  it('renders upload dropzone', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /upload activity file/i })).toBeInTheDocument()
  })

  it('renders activity cards when items exist', () => {
    renderScreen({ items: [MOCK_ACTIVITY] })
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    renderScreen({ loading: true })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error from redux state', () => {
    renderScreen({ error: 'Failed to load' })
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('shows empty state when no items', () => {
    renderScreen({ items: [] })
    expect(screen.getByText(/no activities yet/i)).toBeInTheDocument()
  })

  it('shows pagination when pages > 1', () => {
    renderScreen({ items: [MOCK_ACTIVITY], page: 1, pages: 3 })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/i })).toBeInTheDocument()
  })

  it('prev button is disabled on first page', () => {
    renderScreen({ items: [MOCK_ACTIVITY], page: 1, pages: 3 })
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
  })

  it('next button is disabled on last page', () => {
    renderScreen({ items: [MOCK_ACTIVITY], page: 3, pages: 3 })
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('dispatches fetchActivitiesThunk with next page on Next click', () => {
    const { fetchActivitiesThunk } = jest.requireMock('../../../store/activitiesSlice')
    renderScreen({ items: [MOCK_ACTIVITY], page: 1, pages: 3 })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(fetchActivitiesThunk).toHaveBeenCalledWith({ page: 2, limit: 10 })
  })

  it('shows error for unsupported file type', async () => {
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['data'], 'run.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText(/only .fit and .gpx/i)).toBeInTheDocument()
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  it('uploads a .gpx file and refreshes list', async () => {
    mockedUpload.mockResolvedValue(MOCK_ACTIVITY)
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['<gpx/>'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(2))
  })

  it('shows API error on upload failure', async () => {
    mockedUpload.mockRejectedValue({ response: { data: { message: 'Could not parse file' } } })
    renderScreen()
    const input = screen.getByTestId('file-input')
    const file = new File(['bad'], 'run.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Could not parse file')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd client && npm test -- --testPathPattern="Activities/index|Activities/__tests__" --no-coverage
```

Expected: **FAIL** — component doesn't use Redux or render `ActivityCard` yet.

- [ ] **Step 3: Update the screen**

Replace `client/src/screens/Activities/index.tsx`:

```typescript
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

      {pages > 1 && (
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
```

- [ ] **Step 4: Add new CSS classes to Activities.module.css**

Append to `client/src/screens/Activities/Activities.module.css` (keep all existing classes):

```css
.loading {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 1.5rem;
}

.empty {
  color: #94a3b8;
  font-size: 0.875rem;
  margin-top: 1.5rem;
}

.list {
  margin-top: 1.5rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.pageBtn {
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.pageBtn:hover:not(:disabled) {
  background: #f1f5f9;
}

.pageBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pageInfo {
  font-size: 0.875rem;
  color: #64748b;
  min-width: 60px;
  text-align: center;
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd client && npm test -- --testPathPattern="Activities" --no-coverage
```

Expected: **PASS**

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/Activities
git commit -m "$(cat <<'EOF'
Update Activities screen with paginated list and ActivityCard (Step 7c)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: ActivityDetail screen

**Files:**
- Modify: `client/src/screens/ActivityDetail/index.tsx`
- Create: `client/src/screens/ActivityDetail/ActivityDetail.module.css`
- Create: `client/src/screens/ActivityDetail/__tests__/ActivityDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/screens/ActivityDetail/__tests__/ActivityDetail.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ActivityDetail from '../index'
import type { Activity } from '../../../types/activity'

const mockDispatch = jest.fn().mockReturnValue(Promise.resolve({ payload: undefined }))
const mockNavigate = jest.fn()

jest.mock('../../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'act-1' }),
  useNavigate: () => mockNavigate,
}))

jest.mock('../../../store/activitiesSlice', () => ({
  fetchActivityThunk: jest.fn((id: string) => ({
    type: 'activities/fetchActivity/pending',
    payload: id,
  })),
  deleteActivityThunk: jest.fn((id: string) => ({
    type: 'activities/deleteActivity/fulfilled',
    payload: id,
  })),
}))

jest.mock('../../../components/HRChart', () => ({
  default: () => <div data-testid="hr-chart" />,
}))

import { useAppSelector } from '../../../store/hooks'
const mockUseAppSelector = useAppSelector as jest.Mock

const MOCK_ACTIVITY: Activity = {
  _id: 'act-1',
  userId: 'user-1',
  source: 'strava',
  name: 'Morning Run',
  date: '2026-05-16T08:00:00.000Z',
  distanceMeters: 8200,
  durationSeconds: 2535,
  avgHR: 158,
  maxHR: 178,
  hrStream: [140, 145, 150, 155, 160],
  paceStream: [309, 310, 312],
  cadenceAvg: 176,
  elevationGainMeters: 42,
}

function renderScreen(stateOverrides = {}) {
  mockUseAppSelector.mockReturnValue({
    selected: null,
    loading: false,
    error: null,
    ...stateOverrides,
  })
  return render(
    <MemoryRouter>
      <ActivityDetail />
    </MemoryRouter>,
  )
}

describe('ActivityDetail screen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('matches snapshot', () => {
    const { asFragment } = renderScreen({ selected: MOCK_ACTIVITY })
    expect(asFragment()).toMatchSnapshot()
  })

  it('dispatches fetchActivityThunk with id on mount', () => {
    renderScreen()
    const { fetchActivityThunk } = jest.requireMock('../../../store/activitiesSlice')
    expect(fetchActivityThunk).toHaveBeenCalledWith('act-1')
    expect(mockDispatch).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    renderScreen({ loading: true })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state', () => {
    renderScreen({ error: 'Not found' })
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })

  it('renders activity name and stats', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
    expect(screen.getByText('158 bpm')).toBeInTheDocument()
    expect(screen.getByText('178 bpm')).toBeInTheDocument()
  })

  it('renders HR chart when hrStream is non-empty', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    expect(screen.getByTestId('hr-chart')).toBeInTheDocument()
  })

  it('renders cadence and elevation pills', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    expect(screen.getByText(/176 spm/)).toBeInTheDocument()
    expect(screen.getByText(/42 m/)).toBeInTheDocument()
  })

  it('shows inline confirm on Delete click', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancels delete when Cancel is clicked', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('dispatches deleteActivityThunk on confirm and navigates back', async () => {
    const { deleteActivityThunk } = jest.requireMock('../../../store/activitiesSlice')
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(deleteActivityThunk).toHaveBeenCalledWith('act-1')
      expect(mockNavigate).toHaveBeenCalledWith('/activities')
    })
  })

  it('back button navigates to /activities', () => {
    renderScreen({ selected: MOCK_ACTIVITY })
    fireEvent.click(screen.getByRole('button', { name: /← activities/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/activities')
  })
})
```

- [ ] **Step 2: Run and confirm fail**

```bash
cd client && npm test -- --testPathPattern=ActivityDetail --no-coverage
```

Expected: **FAIL** — screen is a placeholder `<div>`.

- [ ] **Step 3: Build the screen**

Replace `client/src/screens/ActivityDetail/index.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchActivityThunk, deleteActivityThunk } from '../../store/activitiesSlice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import StatCard from '../../components/StatCard'
import HRChart from '../../components/HRChart'
import { ROUTES } from '../../constants/routes'
import styles from './ActivityDetail.module.css'

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function avgPace(paceStream: number[]): string | null {
  if (!paceStream.length) return null
  const avg = paceStream.reduce((sum, v) => sum + v, 0) / paceStream.length
  const mins = Math.floor(avg / 60)
  const secs = Math.round(avg % 60)
  return `${mins}:${String(secs).padStart(2, '0')} /km`
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { selected, loading, error } = useAppSelector((s) => s.activities)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (id) dispatch(fetchActivityThunk(id))
  }, [dispatch, id])

  async function handleDelete() {
    if (!selected) return
    await dispatch(deleteActivityThunk(selected._id))
    navigate(ROUTES.ACTIVITIES)
  }

  if (loading) return <p className={styles.loading}>Loading…</p>
  if (error) return <p className={styles.error}>{error}</p>
  if (!selected) return null

  const pace = avgPace(selected.paceStream)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate(ROUTES.ACTIVITIES)}
          aria-label="← Activities"
        >
          ← Activities
        </button>

        {confirming ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmMsg}>Delete this activity?</span>
            <button className={styles.confirmBtn} onClick={handleDelete} aria-label="Confirm">
              Confirm
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => setConfirming(false)}
              aria-label="Cancel"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={styles.deleteBtn}
            onClick={() => setConfirming(true)}
            aria-label="Delete"
          >
            Delete
          </button>
        )}
      </div>

      <h1 className={styles.name}>{selected.name}</h1>
      <p className={styles.meta}>
        {new Date(selected.date).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        {' · '}
        <span className={styles.source}>{selected.source}</span>
      </p>

      <div className={styles.statCards}>
        <StatCard label="Distance" value={formatDistance(selected.distanceMeters)} />
        <StatCard label="Time" value={formatDuration(selected.durationSeconds)} />
        <StatCard label="Avg HR" value={`${selected.avgHR} bpm`} accentColor="#dc2626" />
        <StatCard label="Max HR" value={`${selected.maxHR} bpm`} accentColor="#f97316" />
      </div>

      {selected.hrStream.length > 0 && (
        <div className={styles.chart}>
          <HRChart hrStream={selected.hrStream} durationSeconds={selected.durationSeconds} />
        </div>
      )}

      <div className={styles.pills}>
        {pace && <span className={styles.pill}>Pace: {pace}</span>}
        {selected.cadenceAvg != null && (
          <span className={styles.pill}>Cadence: {selected.cadenceAvg} spm</span>
        )}
        {selected.elevationGainMeters != null && (
          <span className={styles.pill}>
            Elevation: +{Math.round(selected.elevationGainMeters)} m
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the CSS module**

Create `client/src/screens/ActivityDetail/ActivityDetail.module.css`:

```css
.container {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  background: #f1f5f9;
  min-height: 100vh;
}

.loading,
.error {
  padding: 2rem;
  text-align: center;
  color: #64748b;
}

.error {
  color: #dc2626;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.backBtn {
  background: none;
  border: none;
  color: #6366f1;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.backBtn:hover {
  text-decoration: underline;
}

.deleteBtn {
  background: none;
  border: 1px solid #fca5a5;
  color: #dc2626;
  font-size: 0.875rem;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.deleteBtn:hover {
  background: #fef2f2;
}

.confirmRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.confirmMsg {
  font-size: 0.875rem;
  color: #475569;
}

.confirmBtn {
  background: #dc2626;
  color: #fff;
  border: none;
  font-size: 0.875rem;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.cancelBtn {
  background: none;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-size: 0.875rem;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}

.meta {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem;
}

.source {
  color: #6366f1;
  font-weight: 600;
}

.statCards {
  display: flex;
  gap: 12px;
  margin-bottom: 1.5rem;
}

.chart {
  margin-bottom: 1.5rem;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  background: #eef2ff;
  color: #6366f1;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 6px;
}
```

- [ ] **Step 5: Run and confirm pass**

```bash
cd client && npm test -- --testPathPattern=ActivityDetail --no-coverage
```

Expected: **PASS**

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/ActivityDetail
git commit -m "$(cat <<'EOF'
Add ActivityDetail screen with stat cards, HR chart, and delete flow (Step 7d)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Full test suite + PR

- [ ] **Step 1: Run full client test suite**

```bash
cd client && npm test --no-coverage
```

Expected: **PASS** — all tests green. If any fail, fix the code (not the tests) and re-run before proceeding.

- [ ] **Step 2: Run full server test suite**

```bash
cd server && npm test --no-coverage
```

Expected: **PASS** — all tests green.

- [ ] **Step 3: TypeScript check on both packages**

```bash
cd client && npx tsc --noEmit && echo "client ok"
cd server && npx tsc --noEmit && echo "server ok"
```

Expected: no errors from either.

- [ ] **Step 4: Create the PR**

```bash
git push -u origin add-activity-list-detail
gh pr create \
  --title "Add activity list + detail screens (Step 7)" \
  --body "$(cat <<'EOF'
## Summary
- Server: GET /api/activities (paginated), GET /api/activities/:id, DELETE /api/activities/:id
- Client: activitiesSlice extended with createAsyncThunk for all three endpoints
- Components: StatCard, ActivityCard (gradient left-stripe), HRChart (Recharts)
- Activities screen: paginated list with ActivityCard, upload still works
- ActivityDetail screen: stat cards → HR chart → pace/cadence/elevation pills, inline delete confirm

## Test plan
- [ ] All server controller tests pass
- [ ] activitiesSlice thunk tests pass
- [ ] StatCard, ActivityCard, HRChart snapshot tests pass
- [ ] Activities screen: list renders, pagination dispatches correct page, upload still works
- [ ] ActivityDetail: fetches on mount, delete flow confirms before dispatching, navigates back
- [ ] Full client + server suite green
- [ ] tsc --noEmit clean on both packages

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Await manual review before proceeding to Step 8**
