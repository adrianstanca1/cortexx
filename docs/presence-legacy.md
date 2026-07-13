# Legacy Presence Scripts

## Status

`dist/presence.js` and `dist/presence-ui.js` are **legacy standalone scripts** from an earlier iteration of real-time peer presence. They are **not currently loaded or used** by the Next.js app in `app/`.

## What they do

- `dist/presence.js` implements tab-to-tab peer discovery using `BroadcastChannel`:
  - Heartbeat every 3 seconds, prune peers silent for > 9 seconds.
  - Advertises current screen/focus.
  - Optional cross-device relay via a transport implementing `{ send(frame), onFrame(cb) }`.
  - Exposes `window.CortexPresence` and a global `window.usePresence(screen, focus)` React hook.

- `dist/presence-ui.js` provides UI components that consume `window.usePresence`.

## Why they are preserved

They are kept in `dist/` as reference/legacy assets. They are not part of the current build pipeline and are not referenced by `app/` routes, `components/`, or the main `index.html`/`Cortexx.html` loaders.

## Decision

- **Do not delete** until a product decision is made on whether to add real-time "who is viewing this" presence to the Next.js app.
- **If reviving:** use the modern replacement `lib/usePresence.ts` and load it from relevant pages via `components/ui/PresencePill.tsx` or a custom UI. The SSE stream in `app/api/events/stream/route.ts` can serve as the cross-device transport.
- **If removing:** delete `dist/presence.js` and `dist/presence-ui.js`, then update this doc.

## Current live real-time stack

- Server-side: `app/api/events/stream/route.ts` (SSE, 5 s poll).
- Client-side: `lib/useRealtimeActivity.ts`.
- Cross-tab invalidation: `lib/broadcast.ts` (`BroadcastChannel` for tasks/projects/team).

## Future architecture note

Today the app uses two transports for "live data":

1. **SSE** for server-driven freshness (activities).
2. **BroadcastChannel** for same-origin tab-to-tab invalidation (tasks/projects/team).

A future unification could use SSE as the single source of truth and BroadcastChannel only as a same-tab fast-path fallback, removing the separate invalidation channel. That is a larger refactor and is intentionally left as a design decision rather than implemented here.
