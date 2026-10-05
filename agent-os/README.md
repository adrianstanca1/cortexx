# Cortex Agent OS

Cortex Agent OS is the canonical local-first, permissioned multi-agent runtime for Cortexx. It runs on a VPS alongside Ollama, with an optional OpenAI-compatible cloud fallback, and exposes governed web, CLI and Expo mobile control surfaces.

## Included

- Mission → plan → task → agent → verification orchestration
- Local-first Ollama provider plus optional cloud fallback adapter
- Agent registry with lifecycle controls: spawn, suspend, resume and terminate
- Dynamic agent groups with coordinator, shared-memory and consensus metadata
- Skill catalog/install state with per-agent enablement
- Explicit agent-to-agent delegation with priority and approval gates
- Persistent-memory domain model and PostgreSQL schema
- Permission/approval service with ALLOW / ASK / DENY
- Sandboxed workspace file tools and command-risk classifier
- Authenticated HTTP API and bounded activity history
- Responsive Mission Control web UI, CLI and Expo/React Native mobile control surface
- Secure mobile connection presets stored with Expo SecureStore
- Construction agents: Procurement, Tender Scout, Document Analyst, Safety and Commercial

The richer mobile-control concepts were consolidated from the retired openclaw-mobile prototype. Its hard-coded LAN gateway and unauthenticated control assumptions were intentionally not carried forward.

## Local development

Create a strong operator token first:

    cp .env.example .env
    openssl rand -hex 48

Put the generated value in CORTEX_AGENT_OS_TOKEN, then:

    npm run typecheck
    npm test
    npm run build
    npm start

Open http://localhost:4310. The web UI asks for the operator token and keeps it in session storage only.

## VPS / Docker

    cd infra
    docker compose --env-file ../.env up -d --build

Ollama is expected at OLLAMA_URL. Production must use HTTPS and should expose the API only through an authenticated ingress.

## Mobile

    cd apps/mobile
    npm install
    npx expo-doctor
    npm run typecheck
    npx expo start

Set EXPO_PUBLIC_CORTEX_URL to the reachable HTTPS API URL. The operator token is entered at runtime and stored using Expo SecureStore. Provider API keys are never embedded in the mobile app.

The mobile control surface exposes missions, agent lifecycle, approvals, skill catalog state, delegations, groups and encrypted connection presets.

## Security

- /health is the only unauthenticated endpoint.
- /api/* requires Authorization: Bearer <CORTEX_AGENT_OS_TOKEN>.
- Production refuses to start with an operator token shorter than 32 characters.
- No unrestricted shell execution is enabled by default.
- Sensitive writes, Git pushes, package installs and privileged operations must pass an approval policy.
- Never put API keys, operator tokens or provider credentials in the repository.
