# Baseball Analytics MVP

Internal semi-pro baseball analytics: **Analyst** (full input, charts, overrides) and **Coach** (read-only, decision-focused, no raw stats).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Choose **Analyst** or **Coach**.

## Database setup (Supabase)

**→ Step-by-step checklist: [SETUP-SUPABASE.md](./SETUP-SUPABASE.md)**

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New project**.
3. Pick an organization (or create one), name the project (e.g. `baseball-analytics`), set a database password, and choose a region. Click **Create new project** and wait for it to finish.

### 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` in this repo, copy its full contents, and paste into the SQL Editor.
4. Click **Run** (or press Ctrl+Enter). You should see “Success. No rows returned.” Tables created: `games`, `players`, `plate_appearances`, `defensive_events`, `player_ratings`, `game_lineups`.

### 3. Add env vars

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. Copy **Project URL** and **anon public** (under “Project API keys”).
3. In this repo, copy the example env file and add your values:

   ```bash
   cp .env.local.example .env.local
   ```

4. Edit `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key

5. Restart the dev server (`npm run dev`). The app will use the database; **Analyst → Games** and **Analyst → Players** will show Add/Edit forms and data will persist.

Without Supabase, the app runs with demo data only; nothing is saved.

## Design and architecture

- **Data model & screen flow:** see root `../DESIGN.md`.
- **Architecture & folder structure:** see `ARCHITECTURE.md`.
- **Phase 2 work:** see `TODO.md`.

## Tech

- Next.js (App Router), React, TypeScript, Tailwind
- Supabase (DB; optional auth later)
- Event-first schema; stats and ratings are derived in `src/lib/compute/`.
