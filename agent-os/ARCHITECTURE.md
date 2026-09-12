# Architecture

Control surfaces (Web / Mobile / CLI) → API → Orchestrator → Agent Registry → Model Router / Tool Registry / Memory / Approvals → Ollama or optional cloud provider.

The orchestrator creates dependency-aware tasks from missions and emits lifecycle events. Agents are capability profiles rather than hard-coded processes, allowing dynamic teams. Model routing is local-first and provider-neutral. Tool calls are permission-gated. Memory tracks working, episodic, semantic, project and preference records with provenance.

PostgreSQL is the target durable record store; Redis is the deployment queue/event dependency. The current core also runs dependency-free for tests and development. The runtime boundaries intentionally allow later worker processes, vector search and graph persistence without changing agent contracts.