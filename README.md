# MailTrackr

> **Email open-tracking for Gmail** — Chrome Extension + Backend API + Analytics Dashboard

## Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.

## Architecture

```
Gmail (Chrome Extension)
  ↓ Compose window injection (MutationObserver)
  ↓ Send button intercept → pixel injected
Railway Backend API (Express + TypeScript)
  ↓ GET /pixel/:emailId/:viewerId  → strict no-cache headers
  ↓ POST /api/emails               → register tracked email
  ↓ GET /api/emails/:id            → analytics
PostgreSQL Database
  → emails, viewers, open_events, open_aggregates
Vercel Dashboard (Next.js)
  → Email list, per-email analytics, raw event logs
```

## Project Structure

```
Mail Tracker/
├── backend/          # Express API + PostgreSQL
├── extension/        # Chrome Extension (Manifest V3)
├── dashboard/        # Next.js analytics dashboard
└── DEPLOYMENT.md     # Step-by-step deployment guide
```

## Key Features

- 🔒 Tracking **OFF by default** — user must explicitly enable
- 📧 Confirmation dialog with privacy disclaimer before each send
- 🚫 **Strict no-cache headers** — every pixel load is a real open
- 🕵️ **Gmail proxy detection** — labels opens from Gmail's image proxy
- 📊 First open, last open, total opens — per recipient
- 🌐 Raw event log with browser/OS/IP data

## Development

```bash
# Backend
cd backend
npm install
cp .env.example .env   # Fill in DATABASE_URL
npm run dev

# Dashboard
cd dashboard
npm install
cp .env.example .env.local   # Fill in NEXT_PUBLIC_API_URL
npm run dev
```
