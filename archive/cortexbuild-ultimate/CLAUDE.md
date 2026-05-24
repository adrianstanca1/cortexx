# CortexBuild Ultimate: System Architecture & Integrity

## 1. Inference Pipeline (Unified AI Client)

- **Centralized Client**: All AI requests (Ollama, Gemini, Embeddings) are routed through `server/lib/unified-ai-client-v2.js`.
- **Inference Routing**: Primary: local `qwen3.5:9b`. Secondary: failover to `openrouter`, `ollama-fast`, `ollama-heavy`.
- **Integrity Verification**: `server/test/unified-ai-v2.test.js` ensures interface consistency.

## 2. Database Hardening

- **Audit Triggers**: All core modules utilize `update_updated_at_column()` triggered on `BEFORE UPDATE` to guarantee audit accuracy.
- **Performance Indexes**: Composite indexes established on `projects`, `rfis`, and `invoices` for optimized dashboard performance.

## 3. Security & Dependency Maintenance

- **Vulnerability Management**: Automated pruning and `npm audit fix` enforced.
- **Parity Sync**: Local production-aligned artifacts (deployment/monitoring/scripts) synchronized to ensure environment parity with the VPS.

## 4. Operational Maintenance

- **Self-Healing**: `hermes-reliability-optimizer` skill manages gateway stabilization and model-response error recovery.
- **Monitoring**: All system components are health-checkable via `/api/health`.
- **Dev handoff**: `SESSION.md` holds dated checkpoints; local `npm`/`node` may need `PATH` including Homebrew or nvm (`export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"` on macOS).
