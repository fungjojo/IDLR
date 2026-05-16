# Activity List + Detail Screens — Design Spec
Date: 2026-05-16
Step: 7 of IDLR project plan

---

## Decisions

| Decision | Choice |
|---|---|
| Chart library | Recharts |
| ActivityCard layout | Left-accent stripe (gradient left border, inline stats) |
| ActivityDetail layout | Stats → Chart → Pills, Delete in header |
| Activity list pagination | Numbered pagination (prev/next + page indicator) |
| Delete location | ActivityDetail header only |
| Async pattern | Redux Toolkit `createAsyncThunk` |
| Palette | Light gray `#f1f5f9` base, white cards, indigo `#6366f1` accent, red `#dc2626` / orange `#f97316` for HR |

---

## 1. Server API

Three new endpoints added to `server/src/routes/activities.ts`, handled in `server/src/controllers/activitiesController.ts`. All behind existing `auth` middleware.

### `GET /api/activities`
- Query params: `page` (default 1), `limit` (default 10)
- Filters by `userId` from JWT
- Sorted by `date` descending
- Response: `{ activities: Activity[], total: number, page: number, pages: number }`

### `GET /api/activities/:id`
- Returns single activity with full `hrStream` and `paceStream`
- Returns 404 if not found or `userId` doesn't match requesting user

### `DELETE /api/activities/:id`
- Ownership check — 404 if not found or not owned by requesting user
- Returns 204 on success

---

## 2. Redux + Service Layer

### `client/src/services/activities.ts`
Three new functions alongside existing `uploadActivity`:
- `fetchActivities(page: number, limit: number)` → GET `/api/activities`
- `fetchActivity(id: string)` → GET `/api/activities/:id`
- `deleteActivity(id: string)` → DELETE `/api/activities/:id`

### `client/src/store/activitiesSlice.ts`
Extended with three `createAsyncThunk` actions:
- `fetchActivitiesThunk` — populates `activities[]`, `total`, `page`, `pages`
- `fetchActivityThunk` — populates `selected`
- `deleteActivityThunk` — removes item from `activities[]`, clears `selected`

Existing `setActivities`, `setSelected`, `setLoading`, `setError`, `removeActivity` reducers stay. Thunks use `extraReducers` for `pending/fulfilled/rejected` lifecycle.

**Slice state shape:**
```ts
{
  activities: Activity[]
  selected: Activity | null
  total: number
  page: number
  pages: number
  loading: boolean
  error: string | null
}
```

---

## 3. Components

All under `client/src/components/`. Each gets its own CSS module.

### `ActivityCard`
- Props: `activity: Activity`, `onClick: () => void`
- Layout: 4px gradient left border on the card itself (red `#dc2626` → orange `#f97316`), activity name + date + source label at top, distance / time / avg HR / max HR as inline stats below
- No delete action — delete lives on detail screen only

### `StatCard`
- Props: `label: string`, `value: string`, `accentColor?: string`
- Generic reusable tile: small-caps label, large bold value, optional left border accent colour
- Used in ActivityDetail; extensible for ZoneAnalysis (Step 8)

### `HRChart`
- Props: `hrStream: number[]`, `durationSeconds: number`
- Recharts `LineChart` in a `ResponsiveContainer`
- X-axis: time in minutes (derived from sample index + duration)
- Y-axis: BPM
- Single red line, tooltip showing BPM on hover
- No zone shading — that's Step 8

### Palette tokens (CSS custom properties or constants file)
```
--color-bg: #f1f5f9
--color-surface: #ffffff
--color-text: #1e293b
--color-text-muted: #64748b
--color-label: #94a3b8
--color-border: #e2e8f0
--color-accent: #6366f1
--color-hr-avg: #dc2626
--color-hr-max: #f97316
--shadow-card: 0 1px 3px rgba(0,0,0,.06)
```

---

## 4. Screens

### Activities screen (`client/src/screens/Activities/`)
Keeps existing file upload section. Gains activity list below it:
- On mount: dispatches `fetchActivitiesThunk({ page: 1, limit: 10 })`
- Renders list of `ActivityCard`; click navigates to `/activities/:id`
- Pagination controls at bottom: prev button, page `X of Y`, next button — dispatches `fetchActivitiesThunk` with updated page
- Loading spinner and error message wired to slice state

### ActivityDetail screen (`client/src/screens/ActivityDetail/`)
Full implementation replacing placeholder:
- On mount: dispatches `fetchActivityThunk(id)` via `useParams`
- **Header row:** ← Back (navigates to `/activities`) left · Delete button right
- Delete flow: confirmation step (inline confirm/cancel, not a modal) → dispatches `deleteActivityThunk` → navigates to `/activities` on success
- **Stat cards row:** 4 `StatCard`s — distance, time, avg HR (red accent), max HR (orange accent)
- **HR Chart:** full-width `HRChart` component
- **Pills row:** pace, cadence, elevation — only rendered if values exist on the activity
- Loading and error states handled

---

## 5. Testing

### Server (`server/src/__tests__/activities.test.ts`)
- List returns paginated results in correct shape
- List filters strictly by `userId` (no cross-user data)
- Detail returns 404 when activity belongs to another user
- Delete returns 404 when activity belongs to another user
- Delete removes document and returns 204

### Client
- `activitiesSlice` thunk tests — mock service layer, assert state for `pending/fulfilled/rejected` on each thunk
- `ActivityCard` snapshot
- `StatCard` snapshot (with and without accent colour)
- `HRChart` snapshot (Recharts mocked)
- `Activities` screen — assert `fetchActivitiesThunk` dispatched on mount; pagination buttons dispatch with correct page
- `ActivityDetail` screen — assert detail thunk on mount; delete button shows confirmation; confirmed delete dispatches `deleteActivityThunk`
