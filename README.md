# T-Break

Dutch break-management app for teams, built with React + Vite + Supabase.

Three isolated teams (Klantenservice, Commercieel, Freedom) each with their own ticket pools. Ticket-based break system, queue with 5-minute claim windows, real-time sync via Supabase, MFA support, full admin panel with daily log archive.

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Copy `.env.example` to `.env` and fill in your Supabase URL and anon key:

```bash
cp .env.example .env
```

Then edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Create the database schema

In your Supabase dashboard → **SQL Editor** → **New query**, paste the contents of `supabase/schema.sql` and run it. This creates all tables, RLS policies, triggers, and enables Realtime.

### 4. Configure authentication

In Supabase dashboard:

- **Authentication → Providers → Email**
  - Enable Email provider: **ON**
  - Confirm email: **OFF** (leader-based approval replaces email confirmation)
- **Authentication → Settings → Multi-Factor Authentication** (optional)
  - Enable **TOTP** if you want MFA (compatible with Duo, Google Authenticator, etc.)

### 5. Run the dev server

```bash
npm run dev
```

Opens at http://localhost:5173.

### 6. First login

1. Register an account with your work email
2. In Supabase → **Table Editor → profiles**, find your row, set `approved = true` and `is_leader = true`
3. Sign in — you now have leader access and can approve everyone else from the admin panel

---

## Project structure

```
src/
├── main.jsx              — entry point
├── App.jsx               — top-level wiring (auth, state, rendering)
├── lib/
│   ├── supabase.js       — Supabase client with localStorage auth persistence
│   ├── constants.js      — TEAMS, TYPES, colors
│   ├── helpers.js        — fmt, fmtMs, todayStr, uid, eq
│   └── state.js          — blankState, cleanup, load/save, insertLog, archive
├── hooks/
│   ├── useAuth.js        — session restore + signOut + toggleLeader
│   ├── useAppState.js    — queue-based act() + realtime + all actions
│   ├── useAdminData.js   — pending users + team requests + notifications
│   └── useDarkMode.js
├── auth/
│   └── AuthScreen.jsx    — login/register/pending/MFA
├── components/
│   ├── Header.jsx
│   ├── Ticket.jsx        — Ticket + QueueTicket
│   ├── TicketRow.jsx     — full + compact variants
│   ├── ActiveTicket.jsx
│   ├── OfferTicket.jsx
│   ├── QueueBanner.jsx
│   ├── UsageFooter.jsx
│   └── Toast.jsx
├── leader/
│   ├── LeaderPanel.jsx   — top-level admin panel
│   ├── PendingApprovals.jsx
│   ├── TeamControls.jsx
│   ├── UsersTable.jsx
│   ├── AdminActiveRow.jsx
│   ├── TeamSection.jsx
│   └── ArchiveViewer.jsx — calendar + historical log viewer
└── styles/
    └── globals.css       — all styling (imported once)
```

---

## Architecture

### State

A single row in `public.app_state` (id=1) holds all live state as JSONB:
- `config` — per-team ticket pools and durations
- `active_breaks` — per-team currently-active breaks
- `queues` — per-team queues per ticket type
- `usage` — per-team per-user daily counters
- `sessions` — all users' presence info
- `extra_breaks` — per-team bonuses granted by a leader
- `log` — today's rolling log (last 100 entries)

Writes go through a Promise-chain queue (`actionQueue`) so concurrent mutations never drop writes or deadlock. Reads happen via Supabase Realtime (when enabled) plus a 3s polling fallback.

### Teams

Three isolated pools: `klantenservice`, `commercieel`, `freedom`. Each employee sees only their own team's tickets. Admins are team-neutral and see all three.

Employees can switch teams freely once per day. A second switch the same day creates a `team_change_requests` row which the admin approves or denies from the panel.

### Auth

Email + password via Supabase Auth. The `handle_new_user()` trigger creates a `profiles` row on signup — approved immediately if matched against an invite, otherwise left pending.

MFA is optional (TOTP via any authenticator app).

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo
3. Framework preset: **Vite** (auto-detected)
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

You'll get a URL like `tbreak.vercel.app`. Point a custom domain at it under **Settings → Domains** if desired.

Since the app is now on a real URL (not `file://`), you can also:
- Re-enable Supabase email confirmation if you want
- Set up OAuth providers (Microsoft, Google) by adding your Vercel URL to **Authentication → URL Configuration → Redirect URLs**

---

## Build for production

```bash
npm run build
```

Output is in `dist/`. You can preview it locally with `npm run preview`.

---

## License

Private — internal company tool.
