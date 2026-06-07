# CortexBuild Pro — one-paste commit

Run from your local clone of the project after pulling these changes
(or after extracting the project download).

```sh
git pull --rebase
git add -A
git commit -m "v1.3 — local LLM, payments, bank rec, CIS300/HMRC, push, E2EE, banking, IAP, observability, retention, RIDDOR, parallel boot perf

Frontend: 11 new lib modules + 8 phase screens (100-103, 106-109)
Backend:  7 new server/routes (payments/push/banking/iap/hmrc/llm/agents) + 14 typed tables
Loader:   parallel prefetch — boot ~30s → ~12s
Schema:   16 → 30 tables. NATIVE set 5 → 20.
Bug fix:  duplicate useState in phase103 was crashing Babel parse
Bug fix:  E2EE wrong-passphrase silent-accept (canary verification)
Bug fix:  53 wrong token names (T.surface→bg2, T.line→hair, T.bg→bg1)
Bug fix:  Express route shadowing on /api/:collection

See CHANGELOG.md for the full breakdown."
git push
```

If you have a clean working tree and just want to push:

```sh
git push
```

If there are conflicts on `git pull`:

```sh
git stash
git pull --rebase
git stash pop
# resolve, then add/commit/push
```
