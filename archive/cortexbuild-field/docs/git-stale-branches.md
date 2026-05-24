# Stale remote branches (housekeeping)

This note records **obsolete** remote branches that were safe to remove after a Claude/Cursor integration review. Use it as a template when auditing again.

## When a branch is obsolete

- `git log main..origin/<branch>` is **empty** (nothing unique to merge), or
- The only unique commits were **superseded** by refactors on `main` (e.g. logic moved from `server/routers.ts` to `server/routers/index.ts`), or
- The same fixes already appear on `main` under different paths.

Always verify before deleting:

```bash
git fetch origin
git log main..origin/<branch> --oneline
git log origin/<branch>..main --oneline | head
```

## Removed (2026-05-04)

| Remote branch | Reason |
|---------------|--------|
| `origin/claude/push-notifications` | Single remaining commit adjusted the old monolithic `server/routers.ts`. On current `main`, defect assignee push uses `assigneeForPush` in `server/routers/index.ts` (same TypeScript narrowing fix). |
| `origin/claude/audit-cleanup` | Session audit fixes (super-admin / timesheets `useCallback` deps, duplicate imports, etc.) were already present on `main` or superseded by later merges. |

## Removed (2026-05-04, second pass)

All remaining feature remotes whose **tip commit was already an ancestor of `origin/main`** were deleted in one sweep (29 branches), leaving only `origin/main`. Branches included every prior `claude/*`, `cursor/*`, `feat/*`, `fix/*`, and `chore/*` remote that `git merge-base --is-ancestor origin/<branch> origin/main` reported as fully merged.

If you need historical branch names, use `git log --all --source --remotes` on a clone that still had those refs, or GitHub’s deleted-branch / PR history.

## Delete commands (for future use)

```bash
git push origin --delete <branch-name>
```

Multiple branches in one invocation:

```bash
git push origin --delete branch-one branch-two
```
