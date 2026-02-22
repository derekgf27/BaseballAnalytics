# Supabase setup checklist

Follow these steps to connect the app to your own database.

---

## Step 1: Create a project

1. Open **[supabase.com](https://supabase.com)** and sign in (or create an account).
2. Click **New project**.
3. Choose an organization (or create one).
4. **Name:** e.g. `baseball-analytics`
5. **Database password:** set one and save it somewhere safe.
6. **Region:** pick the closest to you.
7. Click **Create new project** and wait until it’s ready (1–2 minutes).

---

## Step 2: Run the schema

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open **`supabase/schema.sql`** in this repo and copy **all** of its contents.
4. Paste into the Supabase SQL Editor.
5. Click **Run** (or Ctrl+Enter).
6. You should see: **Success. No rows returned.**

That creates the tables: `games`, `players`, `plate_appearances`, `defensive_events`, `player_ratings`, `game_lineups`.

---

## Step 3: Get your API keys

1. In the left sidebar, click **Project Settings** (gear icon).
2. Click **API** in the settings menu.
3. Under **Project URL**, click **Copy**.
4. Under **Project API keys**, find **anon** **public** and click **Copy**.

Keep these for the next step.

---

## Step 4: Add env vars to the app

1. In the **baseball-app** folder, copy the example env file:

   **Windows (PowerShell):**
   ```powershell
   Copy-Item .env.local.example .env.local
   ```

   **Mac/Linux:**
   ```bash
   cp .env.local.example .env.local
   ```

2. Open **`.env.local`** and replace the placeholders:
   - `NEXT_PUBLIC_SUPABASE_URL` = the **Project URL** you copied.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the **anon public** key you copied.

3. Save the file.

---

## Step 5: Restart the dev server

1. Stop the current dev server (Ctrl+C in the terminal).
2. Start it again:
   ```bash
   npm run dev
   ```
3. Open **http://localhost:3000** → **Analyst** → **Games** or **Players**.

You should **not** see the “Connect Supabase…” banner, and the **Add game** / **Add player** forms on those pages will work. Data you add will be stored in your Supabase project.

---

## Verify in Supabase (optional)

In the Supabase dashboard, open **Table Editor**. After adding a game or player in the app, you should see new rows in the `games` and `players` tables.
