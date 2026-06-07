# CortexBuild Pro — Deployment Guide

## Current Status
✅ **Production Ready**

- **App:** Cortexx.html (loads precompiled dist/ by default)
- **Modules:** 98 modules compiled and synced
- **Mode:** Production (zero Babel runtime cost)
- **Cold-start:** ~2-3s full app boot
- **DB:** 58 tables, full CRUD, transactions, sync

## Modes

### Production (default)
```
https://app.cortexbuild.pro/Cortexx.html
```
Loads precompiled `.js` from `dist/` folder. Fast, no Babel needed.

### Development
```
https://app.cortexbuild.pro/Cortexx.html?dev=1
```
Loads `.jsx` from `lib/` and compiles via Babel in-browser. For live editing.

## File Structure
```
project/
├── Cortexx.html              (main app loader)
├── lib/                      (98 source modules: JSX + JS)
│   ├── boot.jsx
│   ├── backend.js
│   ├── screens-phase*.jsx
│   └── ...
├── dist/                     (98 precompiled modules: JS only)
│   ├── boot.js
│   ├── backend.js
│   ├── screens-phase*.js
│   └── ...
├── server/                   (Express backend, optional)
│   ├── index.js
│   ├── schema.sql
│   └── docker-compose.yml
└── DEPLOYMENT.md             (this file)
```

## Deployment Steps

### 1. GitHub (if using)
```bash
git add .
git commit -m "v1.0: CortexBuild Pro production release"
git push origin main
```

### 2. Static Hosting (Vercel, Netlify, GitHub Pages, S3)
```bash
# Copy these files:
- Cortexx.html
- dist/ (entire folder)
- lib/ (optional, for ?dev=1 mode)
- *.js (tokens, helpers, etc)
```

### 3. Server Backend (optional, if using Express)
```bash
cd server
docker-compose up -d
# Sets up Postgres, migrations, API routes
# Configure .env with DATABASE_URL, JWT_SECRET, etc.
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Cold-start (dist) | ~2-3s |
| Module count | 98 |
| Babel needed | No (production) |
| DB schema size | 58 tables |
| Uncompressed JS | ~8.2 MB |
| Runtime memory | ~45 MB (idle) |

## Verification Checklist

- [ ] App boots in prod mode (no ?dev=1)
- [ ] All 98 modules load
- [ ] Dashboard renders with 15 variations
- [ ] Navigation works (all 5 tabs + sheets)
- [ ] Backend CRUD operational (projects, tasks, etc)
- [ ] AI features respond (receipt OCR, task draft, etc)
- [ ] Offline-first sync active
- [ ] Service Worker registered
- [ ] No console errors

## Rollback

If issues occur, revert to the previous commit:
```bash
git revert HEAD
git push origin main
```

## Support

- **Issues:** Check console (F12) for errors
- **Logs:** window.__cortexxBoot shows cold-start time
- **Dev mode:** Append ?dev=1 to URL to load from lib/ for live editing
