# EHR Prototype

Frontend: HTML / CSS / JS  
Backend: Python  
Database: Supabase

This repository contains a minimal frontend scaffold for the EHR Prototype, including:
- `frontend/public/` — static entry files (index, 404, manifest, favicon)
- `frontend/src/` — source code (styles, components, pages, scripts)
- `backend/` and `infra/` placeholders for later

How to run (simple):
1. From repo root:
   ```bash
   npm install --no-save live-server
   npm run start


---

# `package.json` (repo root)
Path: `ehr-prototype/package.json`
```json
{
  "name": "ehr-prototype",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "npx live-server frontend/public --port=3000 --open=frontend/public/index.html"
  }
}
