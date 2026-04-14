# TUP Clinic EHR

This project is a **React + Vite frontend** that talks **directly to Supabase**.

There is no Python backend in the current architecture.

## Stack

- Frontend: React + Vite (`frontend/`)
- Database/Auth/Storage: Supabase
- Hosting: Vercel (configured via `vercel.json`)

## Local Development

From repo root:

```bash
npm install
npm run dev
```

Or run directly inside `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Set these in `frontend/.env` (or in Vercel project settings):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See [frontend/.env.example](frontend/.env.example).

## Build

```bash
npm run build
```

## Vercel Deployment

- `vercel.json` is already configured to:
  - install from `frontend`
  - build from `frontend`
  - publish `frontend/dist`
  - handle SPA routing fallback

After importing the repo in Vercel, only add the two `VITE_...` env vars and deploy.
