# MailTrackr Deployment Guide

## Prerequisites
- [Render](https://render.com) account (free tier)
- [Vercel](https://vercel.com) account (free tier)
- Chrome browser for extension testing

---

## Step 1: Deploy Backend to Render

### 1a. Create Render Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repository
3. Select the `backend` folder as the **Root Directory**

### 1b. Add PostgreSQL

1. In your Render dashboard → **New** → **PostgreSQL**
2. Create the database and copy the **Internal Database URL** (or External if needed).

### 1c. Set Environment Variables

In your Render backend service → **Environment** tab:

```
DATABASE_URL=<paste from step 1b>
NODE_ENV=production
CORS_ORIGIN=*
```

### 1d. Deploy

Render auto-deploys on push. Click **"Manual Deploy"** if needed.

**Wait for deploy to complete**. Check logs for:
```
[Server] Running database migration…
[Server] MailTrackr API running on 0.0.0.0:10000
```

### 1e. Copy Your Render URL

From Render: Copy the generated URL at the top left (e.g., `https://mail-tracker-v60z.onrender.com`)

---

## Step 2: Update Extension URLs

Open these two files and replace the placeholder URL:

**`extension/utils/pixel-generator.js`** — line 3:
```js
const TRACKING_SERVER_URL = 'https://mail-tracker-v60z.onrender.com';
```

**`extension/background/service-worker.js`** — lines 4–5:
```js
const API_BASE_URL = 'https://mail-tracker-v60z.onrender.com';
const DASHBOARD_URL = 'https://YOUR_DASHBOARD.vercel.app';
// Change to actual URLs after deploying dashboard
```

**`extension/popup/popup.js`** — lines 4–5:
```js
const API_BASE_URL = 'https://mail-tracker-v60z.onrender.com';
const DASHBOARD_URL = 'https://YOUR_DASHBOARD.vercel.app';
```

---

## Step 3: Deploy Dashboard to Vercel

### 3a. Create `.env.local` in dashboard folder

```bash
NEXT_PUBLIC_API_URL=https://mail-tracker-v60z.onrender.com
```

### 3b. Deploy via Vercel CLI or GitHub

**Option A: Vercel CLI**
```bash
cd "e:\STUDY\Mail Tracker\dashboard"
npx vercel --prod
```

**Option B: GitHub**
1. Push the `dashboard` folder to a repo
2. Import on vercel.com → set root directory to `dashboard`
3. Add environment variable: `NEXT_PUBLIC_API_URL=<your railway url>`

### 3c. Copy Dashboard URL

After deploy → copy your Vercel URL (e.g., `https://mailtrackr-dashboard.vercel.app`)

---

## Step 4: Update Extension with Dashboard URL

Update **`extension/background/service-worker.js`** and **`extension/popup/popup.js`** with the real dashboard URL.

---

## Step 5: Load Extension in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select the folder: `e:\STUDY\Mail Tracker\extension`
5. Extension is now active!

---

## Step 6: Test End-to-End

1. Open [mail.google.com](https://mail.google.com)
2. Click **Compose**
3. Verify the **MailTrackr toggle** appears in the toolbar (default: OFF)
4. Enable the toggle, write an email, click **Send**
5. Confirm the dialog → email is sent with pixel
6. Open the email on **another device** (or incognito)
7. Open your **MailTrackr dashboard** → enter your Gmail address → verify open is recorded

### Verify No-Cache Headers

Open the sent email → DevTools → Network tab → find the `/pixel/...` request:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

→ Refresh the page → a **new network request** fires (not served from cache) ✓

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Toggle not appearing in Gmail | Reload Gmail page; compose window may need refresh |
| API errors in popup | Check Render logs for errors |
| CORS errors | Ensure `CORS_ORIGIN=*` is set in Render environment variables |
| DB migration fails | Check `DATABASE_URL` in Render PostgreSQL connection |
| Pixel not recording | Check Render logs for `[Analytics] Recorded email open` |
