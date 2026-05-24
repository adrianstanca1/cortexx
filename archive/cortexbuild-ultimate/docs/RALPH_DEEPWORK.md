# Ralph /deepwork triple-review (local)

This repository’s production checks run in **GitHub Actions** via `actions/setup-node` and `.nvmrc` (see `.github/workflows/ci.yml`). The **/deepwork** flow is defined by the **Oh My Claude** plugin for Claude Code / Cursor, not by `npm` scripts in this repo.

## What /deepwork expects

1. **Call tracking** — start and report hooks (plugin-relative paths):

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/hooks/call-tracker.sh" start
   # … work …
   "${CLAUDE_PLUGIN_ROOT}/hooks/call-tracker.sh" report
   ```

2. **Ralph loop init** (optional messaging / loop bootstrap):

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/start-ralph-loop.sh" /path/to/cortexbuild-ultimate
   ```

3. **Triple AI gate (≥ 9.5 each)** — from the plugin’s `deepwork.md`:

   - GPT reviewer via MCP: `mcp__plugin_ohmyclaude_gpt-as-mcp__codex` (model `gpt-5.2`, high reasoning).
   - Gemini reviewer via MCP: `mcp__plugin_ohmyclaude_gemini-as-mcp__gemini` (e.g. `gemini-3-pro-preview`).
   - Opus reviewer: `Task` subagent `oh-my-claude:reviewer` (Opus 4.5).

   All three must run **in parallel**, scores collected, and any score below 9.5 triggers a fix/re-review cycle.

4. **Completion** — only after builds/tests pass **and** the three reviews pass **and** `call-tracker.sh report` has been run, output exactly:

   ```text
   <promise>COMPLETE</promise>
   ```

## Running this outside the plugin

You **cannot** fully automate the triple gate from this repo alone: it depends on **Oh My Claude** MCP servers and subagents configured in your Claude Code / Cursor environment.

**Minimal local substitute:** run the same evidence the gate expects, then do a single human or single-model review:

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"   # macOS: ensure node/npm exist
cd /path/to/cortexbuild-ultimate
npm ci
npm run typecheck && npm run lint && npm test && npm run build
cd server && npm ci && node --check index.js
```

## macOS PATH (developer machines)

If `npm: command not found` in a fresh terminal, install Node 20+ (see `.nvmrc`) and ensure its `bin` directory is on `PATH` (e.g. Homebrew `opt/node@20/bin` or `nvm use`).

## Plugin paths (reference)

If `CLAUDE_PLUGIN_ROOT` is unset, the Oh My Claude plugin cache is often under:

`~/.claude/plugins/cache/oh-my-claude/oh-my-claude/<version>/`

Use the version directory that contains `hooks/call-tracker.sh` and `scripts/start-ralph-loop.sh`.
