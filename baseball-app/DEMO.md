# Portfolio demo deployment

Use a **separate** Supabase project and Vercel deployment from your real team data. The demo ships with fictional sample data and **read-only** mode.

---

## Quick checklist

1. Create Supabase project `baseball-analytics-demo`
2. Run `supabase/schema.sql`
3. Run `supabase/demo-seed.sql`
4. Deploy to Vercel (root directory: `baseball-app`)
5. Set environment variables (below)
6. Put the live URL on your resume

---

## 1. Supabase (demo project only)

1. [supabase.com](https://supabase.com) → **New project**
2. **SQL Editor** → run **`supabase/schema.sql`** (full file)
3. **SQL Editor** → run **`supabase/demo-seed.sql`** (full file)

You should get:
- **Metro City Miners** club roster (14 players)
- Opponent rosters for **Riverside Rockets** and **Harbor Hawks**
- 9 finalized games + 1 **in-progress** game for the Record screen
- Tracked opponents, lineups, PAs, pitch events, baserunning, ratings

**Do not** run `20260611_rls_role_based_security.sql` on the demo project unless you also add login (see optional auth below). The default schema policies allow read access for the anon key.

To reset demo data later, re-run `demo-seed.sql`.

---

## 2. Vercel environment variables

| Variable | Demo value |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Demo project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Demo anon key |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_CLUB_TEAM_NAME` | `Metro City Miners` |

**Do not set** `SUPABASE_SERVICE_ROLE_KEY` on the demo deployment (hides admin user management).

**Auth (recommended for demo):** leave `AUTH_REQUIRED` unset / `false` so recruiters can click through without logging in.

---

## 3. Deploy

See **`DEPLOY.md`** for Vercel import steps. Use a **new Vercel project** (e.g. `baseball-analytics-demo`) pointing at the same GitHub repo with root directory **`baseball-app`**.

After deploy, open the URL — you should see an amber **Portfolio demo** banner and a **tour guide** on the home page.

---

## 4. Resume / portfolio copy

```
Live demo: https://your-demo.vercel.app
GitHub:    https://github.com/you/BaseballAnalytics
```

Suggested 60-second tour (also on the home page):

1. **Coach → Today** — lineup recommendations and alerts  
2. **Coach → Pitch pad** — live pitch-type UI  
3. **Analyst → Dashboard** — team stats and schedule  
4. **Analyst → Stats / Charts** — splits and spray charts  
5. **Analyst → Reports** — pre-game scouting and PDF export  
6. **Analyst → Record** — in-progress game logging UI (read-only)

Direct link to the in-progress game:

`/analyst/record?gameId=e00100a1-000a-4000-8000-00000000000a`

---

## What demo mode does

When `NEXT_PUBLIC_DEMO_MODE=true`:

- Amber banner on every page: **Portfolio demo · read-only**
- Home page **tour guide** with deep links
- All **server actions** that write data are blocked
- Client-side pitch pad / Record sync writes are blocked
- **Read/explore** works normally — stats, charts, reports, coach views

---

## Optional: demo login + stricter RLS

If you want a login wall on the demo:

1. Run auth migrations (`20260608_profiles_roles.sql`, etc.)
2. Create a user with role `analyst`
3. Set `AUTH_REQUIRED=true` on Vercel
4. Share credentials on resume: `demo` / `YourPassword`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Empty roster / no games | Re-run `demo-seed.sql` in SQL Editor |
| “Connect Supabase” message | Check Vercel env vars; redeploy |
| Can still edit data | Confirm `NEXT_PUBLIC_DEMO_MODE=true` and redeploy |
| Build 404 | Vercel root directory = `baseball-app` |

---

## Keeping prod and demo separate

| | Production (team) | Portfolio demo |
|--|-------------------|----------------|
| Supabase | Your real project | **New** demo project |
| Vercel | Main URL | `*-demo.vercel.app` |
| `NEXT_PUBLIC_DEMO_MODE` | unset | `true` |
| Data | Real | Fictional seed |

Never point the public demo at your production Supabase.
