# Contributing to CortexBuild Pro (Cortexx)

Thanks for contributing. This repo runs **three deployment targets off one backend**, so a
change in the wrong place can break prod. Read `CLAUDE.md` first — it explains the non-obvious
conventions that have caused real outages.

## The three CI guards (run them before every commit)

These are enforced in CI; run them locally so you never push a red build:

| Guard | Command | Fails when |
|-------|---------|-----------|
| Build sync | `node build-dist.js --check` | `dist/` is out of sync with `lib/` (you edited `lib/` but forgot to recompile) |
| Data-model drift | `node scripts/prisma-drift-check.mjs` | a raw-SQL table or Prisma model has drifted from its canonical counterpart |
| Smell ban | `node scripts/ban-smell-words.mjs` | `HACK`/`XXX`/`TODO` markers reappear in source |

Plus the always-on gates: `npm test` (canonical suite, must stay green) and `npm run lint` (0 errors).

## Hard rules

1. **Raw SQL is canonical.** `server/db/schema.sql` is the source of truth for the Express API.
   `prisma/schema.prisma` is a *parallel* model for the Next.js stack. Any new table goes in
   `schema.sql` first; the Prisma model is a typed mirror. The drift guard enforces this.
   Never rename a Prisma model that the Next.js admin queries without updating those queries.
2. **`lib/` is the live source of truth for the SPA.** After editing any `lib/*.js|jsx`, run
   `node build-dist.js` and commit the updated `dist/`, or prod serves stale code.
3. **`/api/health` lives above the auth catch-all.** Don't move it below `/api/:collection`
   or the container is marked unhealthy and deploy never converges.
4. **Integration routers mount behind `integrationAuth`.** Only the three entries in
   `INTEGRATION_PUBLIC` (`GET /banking/callback`, `POST /iap/webhook`, `GET /push/vapid`) are public.
5. **Secrets stay in `.env.vault`** (age-encrypted). Never commit `.env`, tokens, or real secrets.
6. **No DB migrations from CI or this VPS without review.** Schema changes go through `schema.sql`
   + a reviewed migration.

## Commit conventions

- Deep-dive / review work: prefix `[verified]`.
- Self-improvement loop work: prefix `[loop]`.
- One logical change per commit; explain *why*, not just *what*.

## Local dev

```bash
npm install                 # also rebuilds dist/ via postinstall
npm run dev                 # Next.js dev server
node server/index.js        # Express API (needs DATABASE_URL)
npm run precompile          # lib/ -> dist/
npm test                    # canonical test suite
npm run quality             # audit + lint + tsc + test — run before shipping
```
