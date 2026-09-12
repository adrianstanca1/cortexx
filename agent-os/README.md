# Cortex Agent OS

A local-first, permission-aware Agentic OS runtime for Cortexx.

## Current vertical slice

- Mission creation and orchestration state
- Agent registry with planner/research/developer/QA profiles
- Local-first model routing abstraction (Ollama preferred)
- HTTP API with health endpoint
- Mission Control web UI
- Strict TypeScript
- Core regression tests
- Zero runtime npm dependencies

## Run

```bash
npm run build
npm test
npm start
```

Open http://localhost:8787

## Environment

```bash
PORT=8787
OLLAMA_MODEL=qwen2.5:7b
CLOUD_MODEL=configured-cloud-model
```

## Next

Add persistent PostgreSQL/Redis state, approval gates, real model adapters, Expo mobile client, WebSocket events, sandboxed tools, long-term memory and multi-agent parallel execution.
