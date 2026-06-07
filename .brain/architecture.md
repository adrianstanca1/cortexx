# System Architecture (Updated)
**Date:** 2026-06-07
**Base OS:** Debian 13 (Trixie) / Kernel 6.8.0
**Core Engine:** 
  - Ollama (Active Containerized): Serving llama3.2:3b and qwen2.5-coder:7b.
  - Llama.cpp (Optimization Tier): Version 9544, symlinked to `/workspace/bin`.
**Application:** Cortexx (Express API + Next.js)

## Project Components
### 1. Cortexx API (/workspace/cortexx)
- **Frontend Logic:** React Native/Next.js with `lib/llm.ts` client.
- **Backend Service:** Express with `server/routes/llm.js` proxy.
- **Agent Layer:** `server/routes/agents.js` using Anthropic Claude for message triage.

### 2. Inference Engine (/workspace/bin)
- **Centralized Binaries:** `llama-cli`, `llama-server`, `llama-tokenize` (v9544).
- **Libraries:** Full suite of `libggml` and `libllama` libraries present.

### 3. Integration Points
- **Next.js:** Calls `/api/llm` which proxies to the `OLLAMA_BASE_URL`.
- **Vision Tasks:** Photos are analyzed via `moondream` (Ollama) in snag analysis and photo comparison routes.

## Deployment Strategy
Current: Dockerized Express + Ollama.
Target: Hybrid deployment where general chat goes to Ollama, but intensive vision/OCR tasks are offloaded to native `llama-server` for maximum throughput and latest model support.
