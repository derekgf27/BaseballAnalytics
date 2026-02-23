# Deploy Baseball Analytics to Vercel

Follow these steps to put your app online so anyone can use it via a link.

**If you see "404: NOT_FOUND"** after deploying:
1. **Settings → General → Root Directory** must be **`baseball-app`**. Save.
2. Turn **off** “Include files outside the root directory in the Build Step” (can confuse the build).
3. **Settings → General → Build & Development Settings**: leave **Build Command** and **Output Directory** empty (so Vercel uses Next.js defaults).
4. In **Deployments**, open the latest deployment and check the **Build** log: it must show “Build Completed” and run from the `baseball-app` folder. If the build failed, fix the error and redeploy.
5. **Redeploy** after any setting change: Deployments → … on latest → Redeploy.

---

## Connect the database to Vercel

After the app is deployed, connect it to Supabase so it can load and save data.

### A. Supabase project (if you don’t have one yet)

1. Go to **[supabase.com](https://supabase.com)** → sign in → **New project** (name e.g. `baseball-analytics`, set a DB password, choose region) → **Create**.
2. When the project is ready: **SQL Editor** → **New query** → paste the full contents of **`supabase/schema.sql`** from this repo → **Run**. You should see “Success. No rows returned.”

### B. Add env vars in Vercel

1. Open your project on **[vercel.com](https://vercel.com)** → **Settings** → **Environment Variables**.
2. Add two variables (for **Production**, or all environments):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | From Supabase: **Project Settings** → **API** → **Project URL** (copy). |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → **Project API keys** → **anon** **public** (copy). |

3. Save each one.

### C. Redeploy

1. Go to **Deployments**.
2. Open the **…** menu on the latest deployment → **Redeploy**.
3. Wait for the new deployment to finish.

Your live site will now use the database. For full local setup, see **SETUP-SUPABASE.md**.

---

## 1. Push your code to GitHub

If the app isn’t in a GitHub repo yet:

1. Create a new repo at [github.com/new](https://github.com/new) (e.g. `BaseballAnalytics`).
2. In your project folder, run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

   (Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your repo.)

If your **entire repo** is the `baseball-app` folder (only the Next.js app), use that folder as the repo root.  
If your repo is **BaseballAnalytics** and the app lives in a **subfolder** `baseball-app`, you’ll set that folder as the root in Vercel in step 3.

---

## 2. Get your Supabase keys

You need these for Vercel:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Project Settings** (gear) → **API**.
3. Copy:
   - **Project URL** → use as `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (e.g. `BaseballAnalytics` or `baseball-app`).
4. **Root Directory** (important if the app is in a subfolder):
   - If your repo is **only** the `baseball-app` contents, leave **Root Directory** empty.
   - If your repo has a **parent folder** and the app is in **`baseball-app`**, click **Edit**, set Root Directory to **`baseball-app`**, and confirm.
5. **Environment Variables** – click **Add** and add:

   | Name                           | Value                    |
   |--------------------------------|--------------------------|
   | `NEXT_PUBLIC_SUPABASE_URL`     | Your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Your Supabase anon key    |

   (Paste the values from step 2. You can leave **Environment** as Production.)
6. Click **Deploy**.

Vercel will build and deploy. When it’s done, you’ll get a URL like `your-project.vercel.app`.

---

## 4. Share the link

- Send that URL to anyone; they can open it in a browser (Chrome, Edge, etc.) with no install.
- Optional: in the Vercel project, go to **Settings** → **Domains** to add a custom domain.

---

## Troubleshooting

- **Build fails:** Check the build log. If it says “root directory” or “no package.json”, set **Root Directory** to `baseball-app` (step 4).
- **App loads but data doesn’t:** Confirm both env vars are set in Vercel (step 5) and that your Supabase project allows requests from your Vercel URL (Supabase usually allows all by default for the anon key).
- **Changes not showing:** New commits to `main` trigger a new deploy automatically. If you use another branch, deploy that branch or merge to `main` first.
