# IDLR Web App — Project Plan

## Context
IDLR (I Don't Like Running) is a closed-team web app for a running group. Members connect their Garmin data (via Strava OAuth or manual FIT/GPX upload), view heart rate and running stats, calculate HR zones using Garmin's 5-zone model, and upload short video clips for in-browser running posture analysis using AI.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | ExpressJS + TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT (admin-controlled signups) |
| State | Redux Toolkit + Context API |
| Video AI | TensorFlow.js MoveNet (in-browser) |
| FIT parsing | `fit-file-parser` (npm) |
| GPX parsing | Native XML parser |
| Strava | OAuth 2.0 + REST API |

---

## Project Structure
```
idlr/
├── client/                    # React frontend
│   └── src/
│       ├── screens/
│       │   ├── Login/
│       │   ├── Dashboard/         # Team activity feed
│       │   ├── Activities/        # My activities list
│       │   ├── ActivityDetail/    # HR chart + stats + zones
│       │   ├── ZoneAnalysis/      # Time-in-zone breakdown
│       │   ├── VideoAnalysis/     # Upload + pose detection
│       │   ├── Profile/           # maxHR, Strava connect
│       │   └── Admin/             # Manage members
│       ├── components/
│       │   ├── HRChart/
│       │   ├── ZoneBar/
│       │   ├── StatCard/
│       │   ├── PoseOverlay/       # TF.js skeleton canvas
│       │   └── ActivityCard/
│       ├── hooks/
│       │   ├── useStrava.ts
│       │   ├── usePoseDetection.ts
│       │   └── useZones.ts
│       ├── services/
│       │   ├── api.ts             # Axios instance
│       │   ├── strava.ts
│       │   └── activities.ts
│       ├── store/                 # Redux slices
│       │   ├── authSlice.ts
│       │   ├── activitiesSlice.ts
│       │   └── userSlice.ts
│       └── constants/
│           ├── zones.ts           # Garmin zone thresholds
│           └── routes.ts
│
└── server/                    # ExpressJS backend
    └── src/
        ├── routes/
        │   ├── auth.ts
        │   ├── strava.ts
        │   ├── activities.ts
        │   └── users.ts
        ├── controllers/
        ├── models/
        │   ├── User.ts
        │   ├── Activity.ts
        │   └── VideoAnalysis.ts
        ├── services/
        │   ├── stravaService.ts   # OAuth + API calls
        │   ├── fitParser.ts       # FIT file processing
        │   └── gpxParser.ts       # GPX file processing
        └── middleware/
            ├── auth.ts            # JWT verification
            └── adminOnly.ts
```

---

## Data Models

### User
```ts
{
  name: string
  email: string
  passwordHash: string
  role: 'admin' | 'member'
  maxHR: number                  // for HRR zone calculation
  restingHR: number              // for HRR zone calculation (Karvonen)
  stravaAccessToken?: string
  stravaRefreshToken?: string
  stravaAthleteId?: number
  createdAt: Date
}
```

### Activity
```ts
{
  userId: ObjectId
  source: 'strava' | 'manual'
  stravaActivityId?: number
  name: string
  date: Date
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  hrStream: number[]             // HR per second/sample
  paceStream: number[]
  cadenceAvg?: number
  elevationGainMeters?: number
  coordinates?: [number, number][]
}
```

### VideoAnalysis
```ts
{
  userId: ObjectId
  activityId?: ObjectId
  videoStoragePath: string
  poseFeedback: string[]         // generated posture notes
  createdAt: Date
}
```

---

## HR Zone Model (Karvonen / Heart Rate Reserve)
Zones calculated using the **Karvonen formula** (Heart Rate Reserve):

```
HRR = maxHR − restingHR
Zone boundary (bpm) = restingHR + HRR × %
```

| Zone | Name | % HRR |
|---|---|---|
| 1 | Warm-up | 50–60% |
| 2 | Easy | 60–70% |
| 3 | Aerobic | 70–80% |
| 4 | Threshold | 80–90% |
| 5 | Max Effort | 90–100% |

HRR accounts for individual fitness level — two athletes with the same `maxHR` but different `restingHR` will have different zone boundaries. Default `restingHR` is 60 bpm.

`useZones.ts` hook computes time-in-zone from `hrStream` array using both `maxHR` and `restingHR`.

---

## Garmin Data Ingestion

### Option A — Strava OAuth
1. User clicks "Connect Strava" → redirect to Strava OAuth
2. Server exchanges code for access/refresh tokens → stored on User model
3. Server calls `GET /athlete/activities` to list runs
4. For each activity: `GET /activities/{id}/streams?keys=heartrate,velocity_smooth,cadence`
5. Background sync on login; webhook for real-time new activity push

### Option B — Manual Upload
1. User uploads `.fit` or `.gpx` file
2. Server detects file type by extension
3. FIT: parse with `fit-file-parser` → extract HR, pace, coordinates
4. GPX: parse XML → extract `<trkpt>` elements with `<extensions>` HR data
5. Normalise both formats into the Activity model

---

## Video Posture Analysis (In-Browser)
- Load `@tensorflow-models/pose-detection` with MoveNet Lightning model
- User uploads or records video clip
- Frame-by-frame keypoint extraction (17 body keypoints)
- Canvas overlay draws skeleton on video
- Analysis checks:
  - Forward trunk lean angle
  - Arm swing symmetry
  - Knee drive height
  - Head/neck alignment
- Feedback strings generated from thresholds → stored in `VideoAnalysis`

---

## API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register` — admin only

### Strava
- `GET /api/strava/connect` — redirect to Strava OAuth
- `GET /api/strava/callback` — token exchange
- `POST /api/strava/sync` — pull latest activities

### Activities
- `GET /api/activities` — list current user's activities
- `GET /api/activities/:id` — detail with full HR stream
- `POST /api/activities/upload` — multipart FIT/GPX upload
- `DELETE /api/activities/:id`

### Users
- `GET /api/users/me`
- `PUT /api/users/me` — update maxHR, name etc.
- `GET /api/users` — admin: list all members
- `DELETE /api/users/:id` — admin only

---

## Build Order
Each step follows this workflow:
**Build → Run tests → Present changes for manual review → Await approval → Commit to git**

Never commit a step without explicit approval.
**Never start a sub-step unless the previous sub-step is marked `[x]` complete. Never start a new step unless all sub-steps in the previous step are `[x]` complete.**

### ✅ Step 1 — Monorepo scaffold
- [x] Init `client/` (React + Vite + TS) and `server/` (Express + TS)
- [x] Shared TS config, ESLint, folder structure under `src/`

### ✅ Step 2 — MongoDB models + Express boilerplate + JWT auth
- [x] Mongoose models: `User`, `Activity`, `VideoAnalysis`
- [x] JWT middleware (`auth.ts`, `adminOnly.ts`)
- [x] `POST /api/auth/login` route + controller
- [x] Redux `authSlice` + Login screen
- [x] Seed script for initial admin user
- [x] Unit tests + snapshot tests

---

### ✅ Step 3 — Admin user management
- [x] 3a. Server: `POST /api/auth/register` (admin-only, invite-style)
- [x] 3b. Server: `GET /api/users` — list all members (admin)
- [x] 3c. Server: `DELETE /api/users/:id` — admin only
- [x] 3d. Client: Admin screen — member list with delete action
- [x] 3e. Client: Admin screen — create/invite member form
- [x] 3f. Unit + snapshot tests, full suite green, PR review

### ✅ Step 4 — Idempotency middleware
- [x] 4a. Server: `IdempotencyKey` Mongoose model — stores key, response snapshot, TTL index (24h auto-expiry)
- [x] 4b. Server: `idempotency` middleware — reads `Idempotency-Key` header; returns cached response if key was seen, otherwise executes handler and stores result
- [x] 4c. Apply middleware to all mutating POST endpoints: `POST /api/activities/upload`, `POST /api/strava/sync`
- [x] 4d. Unit tests for middleware (cache hit, cache miss, missing header), full suite green, PR review

### ✅ Step 5 — FIT/GPX file upload + parsing pipeline
- [x] 5a. Server: `POST /api/activities/upload` with multer
- [x] 5b. Server: `fitParser` service — extract HR, pace, coordinates from `.fit`
- [x] 5c. Server: `gpxParser` service — extract `<trkpt>` HR data from `.gpx`
- [x] 5d. Server: normalise both formats into `Activity` model
- [x] 5e. Client: file upload UI (drag-drop or input)
- [x] 5f. Unit tests for parsers, full suite green, PR review

### ✅ Step 6 — Strava OAuth + activity sync
- [x] 6a. Server: `GET /api/strava/connect` — redirect to Strava OAuth
- [x] 6b. Server: `GET /api/strava/callback` — token exchange, store on User
- [x] 6c. Server: `stravaService` — fetch activities + HR/pace/cadence streams
- [x] 6d. Server: `POST /api/strava/sync` — pull + normalise into Activity model
- [x] 6e. Client: "Connect Strava" button (wires to Profile in step 11)
- [x] 6f. Integration test for callback flow, full suite green, PR review

### Step 7 — Activity list + detail screens
- [ ] 7a. Server: `GET /api/activities`, `GET /api/activities/:id`, `DELETE /api/activities/:id`
- [ ] 7b. Client: `activitiesSlice` + `activities.ts` service
- [ ] 7c. Client: Activities screen — list with `ActivityCard`
- [ ] 7d. Client: ActivityDetail screen — stat cards + full HR stream
- [ ] 7e. Client: `HRChart` component (Recharts or similar)
- [ ] 7f. Unit + snapshot tests, full suite green, PR review

### Step 8 — Zone calculation + zone breakdown UI
- [ ] 8a. `constants/zones.ts` — 5-zone HRR thresholds (% HRR boundaries)
- [ ] 8b. `useZones.ts` hook — compute zone boundaries from `maxHR` + `restingHR` via Karvonen; compute time-in-zone from `hrStream`
- [ ] 8c. Server + Client: add `restingHR` field to User model (default 60); expose on `GET /api/users/me` and `PUT /api/users/me`
- [ ] 8d. Client: `ZoneBar` component
- [ ] 8e. Client: ZoneAnalysis screen — time-in-zone breakdown
- [ ] 8f. Unit tests for zone hook (boundary calc, time-in-zone, edge cases), snapshot tests, full suite green, PR review

### Step 9 — Video upload + TF.js MoveNet pose analysis
- [ ] 9a. Server: video upload endpoint + `VideoAnalysis` CRUD routes
- [ ] 9b. Client: VideoAnalysis screen — upload / record UI
- [ ] 9c. Client: `usePoseDetection.ts` hook — MoveNet Lightning, frame-by-frame keypoints
- [ ] 9d. Client: `PoseOverlay` component — canvas skeleton drawn over video
- [ ] 9e. Client: posture feedback display (lean, arm swing, knee drive, head alignment)
- [ ] 9f. Unit tests for hook logic, snapshot tests, full suite green, PR review

### Step 10 — Dashboard (team feed)
- [ ] 10a. Server: team feed endpoint — recent activities across all members
- [ ] 10b. Client: Dashboard screen — activity feed using `ActivityCard`
- [ ] 10c. Unit + snapshot tests, full suite green, PR review

### Step 11 — Profile screen
- [ ] 11a. Server: `GET /api/users/me`, `PUT /api/users/me`
- [ ] 11b. Client: `userSlice` + `users.ts` service
- [ ] 11c. Client: Profile screen — maxHR config form
- [ ] 11d. Client: Strava connect/disconnect button (links to step 6e)
- [ ] 11e. Unit + snapshot tests, full suite green, PR review

---

## UI Enhancements (post-completion)

### Admin screen (`client/src/screens/Admin/`)

#### Layout
- [ ] Wrap `<table>` in a `<div>` and move `border-radius`, `overflow: hidden`, and `box-shadow` to the wrapper — `border-collapse: collapse` on a `<table>` ignores `overflow: hidden`, so rounded corners don't render correctly
- [ ] Add `@media (max-width: 600px)` breakpoint to drop the 2-column form grid to a single column
- [ ] Keep "Add Member" visible when the form is open (toggle label to "Cancel"), or mirror the Cancel action into the header — right side of header is empty while the form is shown

#### Interaction
- [ ] Add `.cancelButton:disabled { opacity: 0.5; cursor: not-allowed; }` — the Cancel button is disabled during submission but has no visual feedback
- [ ] Move delete error to appear near the table rather than below the form when the form is open
- [ ] Add success feedback after creating a member (inline message or highlighted new row)
- [ ] Add "Actions" text (or `aria-label`) to the empty `<th />` in the actions column

#### Accessibility
- [ ] Add `role="status"` and `aria-live="polite"` to the loading and empty-state paragraphs
- [ ] Add `aria-label={`Delete ${member.name}`}` to the Delete and Confirm buttons so screen readers announce which member is targeted

#### Polish
- [ ] Add `tr:hover` row highlight to make it easier to track which row you're acting on
- [ ] Show member count in the header (e.g. `Members (3)`)

---

## Verification
- Jest unit tests for zone calculation logic and file parsers
- Integration test for Strava OAuth callback flow
- Manual test: upload a real `.fit` file, verify activity appears correctly
- Manual test: upload a running video, verify skeleton overlay renders
- Run `tsc --noEmit` on both client and server before marking complete
