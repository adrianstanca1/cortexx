# Cortexx — Repository setup & deploy

Everything in this folder is the complete Cortexx app. It runs with **no build step** —
open `Cortexx.html` in any modern browser. `lib/*` is the source of truth; `dist/*` is
an optional precompiled mirror (see "Keep lib/ and dist/ in sync" in `README.md`).

## Integrity review — PASSED ✓ (last checked this session)

- **15/15 dashboards** defined (`DashV1`…`DashV15`)
- **All key screens** defined (Money, Payments ledger, Quotes, Safety, Reports,
  Notifications, Workspace switcher, Checkout, Data export, Audit, SSO, Billing,
  Photo review, …)
- **All helper layers** present: `CortexTenant`, `CortexAudit`, `CortexMembers`,
  `CortexNotifPrefs`, `CortexPayments`, `cortexxInvoicePDF/QuotePDF/ReportPDF`,
  `Backend`, `CortexLocalAgent`
- **Multi-CDN resilient loader** — React/Babel load from jsDelivr, falling back to
  unpkg then cdnjs, so a single CDN outage can't blank the app
- **Service worker** precaches CDN deps + all `lib/` sources + `dist/` mirror + shell
  (resilient `Promise.allSettled` — one missing file can't abort offline support)
- Navigation sweep — zero console errors; AI agent responds with live Brain data

## 1 · Create the repo and push (run on your machine)

```sh
cd path/to/this/folder
git init
git add -A
git commit -m "Cortexx — full app (multi-tenant, 15 dashboards, AI agent, PDF export)"

# create an EMPTY repo on github.com first (no README), then:
git remote add origin https://github.com/<you>/cortexx.git
git branch -M main
git push -u origin main
```

## 2 · Subsequent updates

```sh
git add -A
git commit -m "your message"
git push
```

## 3 · Pull / fetch / resolve conflicts (standard flow)

```sh
git fetch origin
git pull --rebase origin main      # replay your commits on top of remote
# if conflicts: edit the marked files, then
git add <file> && git rebase --continue
git push
```

## 4 · Deploy (static — no server runtime needed)

Any static host works because the app is pure client-side:

- **Vercel:** `vercel --prod` (root dir, no framework preset)
- **Netlify:** drag the folder onto the dashboard, or `netlify deploy --prod`
- **GitHub Pages:** push to `main`, enable Pages → root, open `/Cortexx.html`
- **Nginx/VPS:** copy the folder to the web root; serve `Cortexx.html` as index

## Notes

- The app persists to `localStorage` / `IndexedDB`, namespaced **per workspace**
  (`CortexTenant`). No backend database is required for the demo to be fully functional.
- `lib/local-agent.js` is the reference full agent; the production agent is **inlined**
  into `Cortexx.html` so the AI can never fail to load.
