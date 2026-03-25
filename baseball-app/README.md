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

## Sign-in (Supabase Auth)

Routes are **open by default** (no login wall). The **login page** shows **Google only**; email magic-link helpers live in `src/lib/auth/emailMagicLink.ts` if you add that UI back later.

- **Enforce sign-in (e.g. production):** set **`AUTH_REQUIRED=true`** in `.env.local` / Vercel. Until then, you won’t be redirected to `/login`, and visiting `/login` sends you to the home page.
- **Emergency bypass** if you ever lock yourself out: **`AUTH_DISABLED=true`** (forces the app open even when `AUTH_REQUIRED=true`).

### Email provider (Supabase)

When you re-enable the email UI, enable **Email** under **Supabase → Authentication → Providers**.

### Sign in with Google

1. **Google Cloud Console** ([console.cloud.google.com](https://console.cimage.pngloud.google.com)):
   - Create or select a project.
   - **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add your app origins, e.g. `http://localhost:3000` and `https://your-domain.vercel.app`.
   - **Authorized redirect URIs**: add Supabase’s callback (not your app URL). In Supabase go to **Authentication → Providers → Google** and copy the **Callback URL** shown there — it looks like  
     `https://<project-ref>.supabase.co/auth/v1/callback`  
     Paste that exact URL into Google’s redirect URIs.
2. **Supabase → Authentication → Providers → Google**: turn **Enable**, paste **Client ID** and **Client Secret** from Google, save.
3. **Authentication → URL configuration → Redirect URLs** must include your app callback:
   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>/auth/callback`

### All sign-in methods

- (Optional) Set **`ALLOWED_EMAILS`** in Vercel / `.env.local` to a comma-separated allowlist (applies to Google and email). If unset, any authenticated user can access.
- **Row Level Security:** After auth works, run `supabase/rls_policies.sql` in the SQL Editor so anonymous traffic cannot read tables. Adjust policies for your org.

## PWA (install on phone / desktop)

- A **Web App Manifest** is served at `/manifest.webmanifest` (`src/app/manifest.ts`).
- In Chromium / Edge / Chrome: open the site → install icon in the address bar, or **Menu → Install app**.
- On iOS Safari: **Share → Add to Home Screen**.

Replace `public/favicon.svg` with maskable PNG icons (192×192 / 512×512) when you have team artwork for a richer install tile.

## Design and architecture

- **Data model & screen flow:** see root `../DESIGN.md`.
- **Architecture & folder structure:** see `ARCHITECTURE.md`.
- **Phase 2 work:** see `TODO.md`.

## Batting stats (derived)

Stats like **P/PA (pitches per plate appearance)** are computed in `src/lib/compute/battingStats.ts` from plate appearances — nothing extra is stored in the DB except per-PA `pitches_seen` when you log it.

**P/PA** = total pitches seen ÷ total plate appearances (only shown when at least one PA has a pitch count recorded).

**RISP (runners in scoring position)** = plate appearances where a runner was on **2nd and/or 3rd** before the PA (standard definition). The app uses `base_state` (3 characters: 1st/2nd/3rd) set when recording each PA. **RISP** splits and **AVG (RISP)** include **P/PA** computed only from those PAs (when pitch counts are logged). Counting stats like IBB may show **—** when there is no split data (e.g. no RISP PAs).

**Stolen bases / caught stealing** are stored in `baserunning_events` (runner, game, SB or CS). Use **SB** / **CS** on the runner controls in **Record PAs** to log them without saving the plate appearance. **SB%** = SB ÷ (SB + CS) when there is at least one attempt. Legacy `stolen_bases` on a PA row (if any) still counts toward SB totals.

Example: **500 ÷ 120 ≈ 4.17** pitches per plate appearance.

## Tech

- Next.js (App Router), React, TypeScript, Tailwind
- Supabase (DB + Auth + optional RLS)
- Event-first schema; stats and ratings are derived in `src/lib/compute/`.
