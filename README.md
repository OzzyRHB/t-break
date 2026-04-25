# T-Break

A real-time break management app for teams. Employees claim timed break tickets — BRB (3 min), Short (15 min), Lunch (30 min) — while admins monitor who's on break, manage ticket availability per team, and review logs.

---

## Features

- **Ticket-based breaks** — each team has a configurable pool of BRB, Short, and Lunch tickets
- **Real-time sync** — all clients update instantly via Supabase Realtime
- **Queue system** — employees join a waitlist when tickets are full; they receive a 5-minute claim window when a slot opens
- **Admin panel** — manage ticket counts, end breaks, approve team change requests, view live status
- **Overtime detection** — tracks and logs when employees return late; shown in the log with `LAAT +Xm`
- **Dynamic teams** — admins can create, rename, recolor, and delete teams with a built-in HSL color picker
- **Gebruikersbeheer** — full user management: approve accounts, assign teams, grant extra breaks, reset passwords, export logs
- **Log archive** — daily logs preserved at midnight; browsable via calendar modal with CSV export per day or date range
- **Dark mode** — persistent across sessions
- **MFA support** — TOTP two-factor authentication via Supabase Auth

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Backend / DB | Supabase (Postgres + Realtime + Auth) |
| Hosting | Vercel |
| Styling | Plain CSS with CSS variables |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher (comes with Node)
- A [Supabase](https://supabase.com/) project (free tier works fine)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/ozzy-app/t-break.git
cd t-break
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are in your Supabase dashboard under **Project Settings → API**.

### 4. Set up the database

Run this migration in **Supabase Dashboard → SQL Editor**:

```
supabase/migration_teams.sql
```

This creates the `teams` table and seeds the default teams.

The app also requires these tables in `app_state` (single row, id=1):
`profiles`, `app_state`, `logs`, `team_change_requests`

### 5. Configure Supabase Auth URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL** → your deployment URL (e.g. `https://tbreak.vercel.app`)
- **Redirect URLs** → add `https://tbreak.vercel.app/**` and `http://localhost:5173/**`

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Build for production

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

Deploy to Vercel by connecting the GitHub repo — it auto-deploys on every push to `main`.  
Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Vercel → Project → Settings → Environment Variables**.

---

## Project structure

```
t-break/
├── src/
│   ├── auth/           # Login / register screen
│   ├── components/     # Shared UI (Header, Ticket, TicketRow, Toast…)
│   ├── hooks/          # useAuth, useAppState, useAdminData, useDarkMode
│   ├── leader/         # Admin panel components
│   ├── lib/            # Supabase client, state, export, TeamsContext
│   └── styles/         # globals.css
├── supabase/
│   └── migration_teams.sql
├── index.html
├── vite.config.js
└── .env                # Not committed — create this file locally
```

---

## First-time setup

1. Register an account at the app URL
2. In **Supabase Dashboard → Table Editor → profiles**, find your row and set `approved = true` and `is_leader = true`
3. Log back in — you'll have full admin access
4. Add employees by having them register; approve them from the **Gebruikersbeheer** panel inside the app

---

## Platform notes

| OS | Notes |
|---|---|
| **macOS** | Works out of the box with Node from [nodejs.org](https://nodejs.org) or `brew install node` |
| **Linux** | Use your package manager (`apt install nodejs npm`) or [nvm](https://github.com/nvm-sh/nvm) |
| **Windows** | Install Node from [nodejs.org](https://nodejs.org); use PowerShell, Command Prompt, or Windows Terminal. WSL2 also works. |

---

## License

Private — all rights reserved.
