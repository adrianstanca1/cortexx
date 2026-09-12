# Cortex Agent OS

Cortex Agent OS is a local-first, permissioned multi-agent runtime and Mission Control surface. It is designed to run on a VPS alongside Ollama while allowing optional OpenAI-compatible cloud fallback.

## Included

- Mission → plan → task → agent → verification orchestration
- Local-first Ollama provider plus cloud fallback adapter
- Agent registry with Supervisor, Research, Developer, QA and construction specialists
- Persistent-memory domain model and PostgreSQL schema
- Permission/approval service with ALLOW / ASK / DENY
- Sandboxed workspace file tools and command-risk classifier
- SSE live activity stream
- HTTP API, responsive Mission Control web UI and CLI
- Expo/React Native mobile Mission Control scaffold
- Docker Compose for API, PostgreSQL and Redis
- Construction agents: Procurement, Tender Scout, Document Analyst, Safety and Commercial

## Local development

```bash
cp .env.example .env
npm run typecheck
npm test
npm run build
npm start
```

Open `http://localhost:4310`.

## VPS / Docker

```bash
cd infra
docker compose up -d --build
```

Ollama is expected at `OLLAMA_URL`; on Linux Docker you may prefer the host gateway or run the API with host networking.

## Mobile

```bash
cd apps/mobile
npm install
npx expo-doctor
npx expo start
```

Set `EXPO_PUBLIC_CORTEX_URL` to the reachable HTTPS API URL.

## Security

No unrestricted shell execution is enabled by default. Sensitive writes, Git pushes, package installs and privileged operations must pass an approval policy. Never put API keys in the repository.