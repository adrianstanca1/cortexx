# Audit: read-only inventory of /root agent stacks

## Context

User asked for a "full audit + apply fixes" across all systems on this box, with a swarm of agents optimizing for "extreme results." I pushed back twice: the systems overlap, the request is too vague, and a plaintext OpenAI token is sitting in `~/.hermes/auth.json`. User then scoped to: **read-only audit first**, no destructive changes, no swarm yet.

This document is the deliverable for that scoped request. It is **read-only** — nothing has been changed. The next step requires the user to decide what to keep.

## Hardware (read-only)

- 8 vCPU AMD EPYC 9354P, 32 GB RAM, **no GPU**, **no swap**, 327 GB free disk, 1% inode use.
- Inference is CPU-only. This is the binding constraint for everything below.

## Ollama state (the real perf bottleneck)

3 models, 5 config rewrites in 3 hours, 1 ghost server:

| Model | Size | Context | Quant | Fits RAM? |
|---|---|---|---|---|
| `gemma4:latest` | 9.6 GB | 131k | Q4_K_M | yes, easy |
| `north-mini-code-1.0` | ~18 GB | 500k | Q4_K_M | tight, no headroom |
| `laguna-xs-2.1` | ~20 GB | 262k | Q4_K_M | tight, no headroom |

Loading any two of {north, laguna} at once will thrash or OOM — there isn't 32 GB to spare once the OS + daemons are accounted for. There is no swap, so OOM is a hard kill, not a slow crawl.

**Churn**: `~/.ollama/config.json` has been rewritten 5 times since boot, cycling through `laguna-xs-2.1`, `north-mini-code-1.0`, `kimi-k2.7-code:cloud`, and back. Something — possibly the `ollama launch claude` wrapper process — is actively switching the default. This is destabilizing and likely the source of any "performance" complaints.

**Ghost server**: a `llama-server` is running on `127.0.0.1:34075` with hand-rolled flags (`-c 4096`, `--no-jinja`, `chatml`, `-b 512 -ub 512`, `--no-mmap`, `--flash-attn auto`, `--context-shift`). This is not Ollama's own server (that's on `:11434`). Two competing local LLM daemons on the same box is not "extreme performance," it's contention.

## The 4 stacks

### Claude Code (~7 MB, healthy)
- 37 plugins installed under `~/.claude/plugins/marketplaces/claude-plugins-official/plugins`. Most are language-specific LSPs (clangd, csharp, gopls, jdtls, kotlin, lua, php, pyright, ruby, rust-analyzer, swift, typescript). For one user on one box, this is overkill.
- `settings.json` is `{"theme": "dark"}` only. No hooks, no permissions, no model config.
- 11 session transcripts, ~1.4 MB total. Memory dir is empty.
- Daemon is fine: starts, settles workers, idle-exits after 5s. **Not** a problem child.

### Hermes (305 MB, running, **leaks a credential**)
- `~/.hermes/auth.json` (mode 600) contains a live OpenAI ChatGPT OAuth `access_token` + `refresh_token` for `adrian.stanca1@gmail.com`. Refresh token does not expire on its own. The file is in the user's home directory; if the box is ever imaged, snapshotted, or rsynced without `-p` preservation, the token goes with it.
- Config flag `approvals.destructive_slash_confirm: false` — destructive actions skip confirmation.
- 14 persona presets (`catgirl`, `kawaii`, `noir`, `pirate`, `uwu`, `hype`, etc.) — `SOUL.md` is the actual system prompt. Hermes is currently a personal-assistant toy with a real OpenAI account attached.
- Dashboard listening on `0.0.0.0:4860` — reachable from any network this box is on.
- **Running** with 162 MB RSS for the main process, 166 MB for the gateway.

### Codex (465 MB, configured but idle)
- Has its own `id_token` in `~/.codex/auth.json`. `OPENAI_API_KEY` is null, so it relies on OAuth.
- 4 sqlite stores: `goals_1`, `logs_2`, `memories_1`, `state_5`. None large.
- `[projects."/root"] trust_level = "trusted"` — auto-approves.
- **Not currently running**. Installed and ready but not active.

### agentmemory / iii (32 MB, running, network-exposed)
- 2 `iii` processes (one in `/opt/agentmemory`, one in `~/.agentmemory` — duplicate install).
- Listening on `127.0.0.1:3111`, `127.0.0.1:3112` (HTTP API + state), and `0.0.0.0:49134` (network-exposed — unclear what serves this).
- Uses SQLite state store at `data/state_store.db` and a `stream_store` directory.
- 25 MB RSS total — small, but two duplicate processes is wasteful.

## `package.json` situation (correction)

I flagged this as alarming in the previous turn. After reading the actual packages:

- `all@0.0.0` — real (old) package by Dominic Tarr, a 4-line async-callback helper. **Benign**.
- `node.js@0.0.1-security` — npm's official security-holding package, README literally says "this package name is not currently in use, but was formerly occupied." **Benign placeholder**.
- `ios@0.0.1` — author "xs", `server.js` that listens on `:8888` and prints "Hello World", `package.json` description is `"test"`. **Inert** (nothing is bound to 8888, nothing imports it) but **unexplained**. Worth knowing where this came from but no action needed.

I was wrong to lump them together. Two are npm's own mechanisms for handling name squatting; only `ios` is odd, and it isn't doing anything.

## What the audit recommends — but does NOT do

These are findings, not actions. Each one needs your sign-off.

### High-value, low-risk if you want them
1. **Pin Ollama to one model.** Pick `gemma4` for general chat (fits in RAM, has vision/audio/tools). Use `north-mini-code-1.0` only for code, `laguna-xs-2.1` only if you have a reason. **Never** load two of the large models at once. Stop letting `ollama launch claude` rewrite the config.
2. **Pick one agent runtime.** Claude Code, Hermes, and Codex are all LLM CLI tools with overlapping jobs. Three is too many to keep in sync. If you actually use one of them, the other two are attack surface and disk space.
3. **Stop the duplicate `iii` process.** The one in `/opt/agentmemory` and the one in `~/.agentmemory` are doing the same job. Pick one and disable the other.
4. **Bind Hermes dashboard to localhost.** Change `:4860` from `0.0.0.0` to `127.0.0.1`. Same for `iii:49134` if you can identify which worker exposes it.
5. **Disable `destructive_slash_confirm: false`.** One-line fix in Hermes config. If you ever regret it, flip it back.

### Worth doing but needs you
6. **Rotate the OpenAI token in `~/.hermes/auth.json`.** The current refresh token is plaintext on disk. `hermes logout` or the OpenAI dashboard's "sign out all sessions" both work.
7. **Find out why `ios` is in `package.json`.** `git log` if there's a repo, or check shell history. If you can't account for it, remove the three deps and `npm install` clean.

### Things I'm explicitly NOT recommending
- "Swarm of agents installing the best stack." Without a GPU, the best stack here is the one that uses your existing hardware. Adding agents doesn't add compute; it adds contention.
- Removing plugins from Claude Code. 37 is a lot, but they're cheap (disk only, not loaded) and trimming without knowing which ones you use is exactly the kind of optimization that costs more time than it saves.
- Touching the running `llama-server` on `:34075`. I don't know what's pointing at it.

## What I need from you to continue

This audit is done. To do anything beyond it, I need a **scoped, single-stack, reversible** next step. The two I think would help most:

- **(A) Stop the Ollama churn + pin a sane default.** Read-only-ish: change `~/.ollama/config.json` defaults, stop the wrapper rewriting it. This addresses the actual perf problem.
- **(B) Tighten Hermes security.** Rotate the token (you do this), bind dashboard to localhost, enable confirmations. Leaves Hermes running, just less exposed.

Pick one. Or pick a different scoped task. I will not "install the best setup" — the best setup for this box is fewer things, not more.
