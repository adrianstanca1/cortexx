# Security: credentials in git history — rotation required

**Discovered 2026-05-17 by gitleaks audit. Current code tree is clean — values are in historical commits only.**

Git history scan (`gitleaks detect --source .`) of this PUBLIC repository surfaces 11 findings across 4 historical commits. All flagged files are no longer in the current tree (already removed by earlier "clean repository" commits) but **remain visible to anyone running `git log -p`** against any clone.

The cleanup commits removed the files from the tree but did NOT rewrite history. Removing tracked files in a later commit does not unpublish their prior content.

## Credentials present in git history

Values below are MASKED — only enough characters are shown for the operator to
correlate them with their secret manager / Google Cloud Console entries. The
full values are recoverable from `git log -p` for the listed commits, which is
exactly why they need rotation.

| Commit                  | File                        | Masked value                          | Type                           |
| ----------------------- | --------------------------- | ------------------------------------- | ------------------------------ |
| `c5597736`              | `nextjs_space/.env.backup`  | `AUTH_SECRET=MlKVwM...` (32 chars)    | NextAuth JWT signing secret    |
| `c5597736`              | `nextjs_space/.env.backup`  | `API_KEY=aab7e2...` (32 hex chars)    | Internal API key               |
| `890baba9` / `8bb411b5` | `nextjs_space/.env`         | (same two values above)               | tracked .env                   |
| `1f416d02`              | `nextjs_space/.env.example` | `CLIENT_SECRET="GOCSPX-shbt6W...DoP"` | Google OAuth 2.0 client secret |
| `17653e9a`              | `SETUP_COMPLETE.md`         | (auth secret + api key pasted)        | docs                           |
| `f2953606`              | `API_SETUP_GUIDE.md`        | (api key pasted as example)           | docs                           |
| `dfefed15`              | `PUBLIC_DEPLOYMENT.md`      | (auth secret pasted)                  | docs                           |

## Required actions (manual — needs the operator)

1. **Rotate the NextAuth `AUTH_SECRET`** (the one starting `MlKVwM...`). Any auth tokens signed with the leaked secret can be forged by anyone reading the public repo history. Generate a new 32-byte secret (`openssl rand -base64 32`) and update wherever the `nextjs_space` service is deployed.
2. **Rotate the internal `API_KEY`** (the one starting `aab7e2...`). Same rationale.
3. **Rotate the Google OAuth 2.0 client secret** (the one starting `GOCSPX-shbt6W...`) via the Google Cloud Console — Credentials → OAuth 2.0 Client IDs → the affected client → "Reset Secret".
4. **Optional but recommended**: rewrite history with `git filter-repo --invert-paths --path nextjs_space/.env --path nextjs_space/.env.backup --path nextjs_space/.env.example` and force-push. This is destructive (breaks clones/forks) but it is the only way to make the leaked values disappear from `git log -p`. Schedule the force-push when no PRs are in flight.

## Prevention going forward

- A `.gitleaksignore` file at the repo root marks the 11 historical findings as "known", so CI will not re-flag them.
- A `.github/workflows/gitleaks.yml` workflow now runs on every push and pull request — any NEW credential pattern will fail CI before it merges.
- Operator preference (`/root/CLAUDE.md` → "Working with Adrian"): never echo credentials into chat transcripts, `chmod 600` for any `.env`, never commit tokens.

## Verification after rotation

After the operator rotates the three credentials above, this file can be archived (move to `docs/security-incident-2026-05-17.md`). The historical leaks become useless once the values are invalidated upstream, even though they remain visible in git history.
