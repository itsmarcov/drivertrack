# Deploy DriverTRACK on Render (Free Tier)

## Overview

- **Web Service**: Node.js app (spins down after 15 min idle, wakes on request)
- **PostgreSQL**: Free 1GB database (persistent, always-on)
- **Cost**: $0 (no credit card required for PostgreSQL)

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/drivertrack.git
git push -u origin main
```

## Step 2: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **New +** → **PostgreSQL**
3. Fill in:
   - **Name**: `drivertrack-db`
   - **Database**: `drivertrack`
   - **User**: `drivertrack_user`
   - **Plan**: Free
4. Click **Create Database**
5. Wait for it to be ready (3-5 min)
6. Copy the **Internal Database URL** (looks like `postgresql://drivertrack_user:...@aws-0-...:5432/drivertrack`)

## Step 3: Deploy Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repo
3. Fill in:
   - **Name**: `drivertrack`
   - **Runtime**: Docker
   - **Branch**: `main`
   - **Plan**: Free
4. Click **Deploy**
5. After deploy fails (expected — needs env vars), go to **Environment** tab
6. Add these environment variables:

| Key | Value |
|---|---|
| `DATABASE_URL` | Paste the Internal Database URL from Step 2 |
| `JWT_SECRET` | Click "Generate" or paste a random 64-char hex string |
| `QR_SECRET` | Click "Generate" or paste a different random 64-char hex string |

7. Click **Save Changes** → this triggers a redeploy
8. Wait for build + deploy (5-10 min)

## Step 4: Verify

1. Go to your service URL (e.g. `https://drivertrack.onrender.com`)
2. Log in with default credentials:
   - **Admin**: `admin` / `Admin@123`
   - **OPS**: `ops1` / `Ops@123`
   - **Driver**: `driver1` / `Driver@123`

## Important Notes

### First request is slow
Free web services **spin down after 15 minutes of inactivity**. The first request after idle takes 10–30 seconds to wake up. Subsequent requests are fast.

### Data persistence
Your data lives in **PostgreSQL**, not on the app server. It persists across restarts, redeploys, and spin-downs. **No data loss.**

### Default secrets
Change these in production:
- `JWT_SECRET` and `QR_SECRET` should be random values
- Delete default users (`admin`, `ops1`, `driver1`, `driver2`) after creating your own

### Updating
Push to `main` → Render auto-deploys. The PostgreSQL DB is separate and survives redeploys.

## Troubleshooting

**App crashes on startup:**
- Check **Logs** tab in Render dashboard
- Common issue: `DATABASE_URL` not set or wrong format

**"relation 'users' does not exist":**
- The schema is auto-created on first run. If it failed, check `DATABASE_URL` is correct
- Restart the web service from Render dashboard

**Connection refused to PostgreSQL:**
- Make sure you're using the **Internal Database URL** (not the external one)
- The web service and DB must be in the same region
