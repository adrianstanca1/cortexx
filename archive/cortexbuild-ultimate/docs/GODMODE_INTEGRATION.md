# Godmode Red-Teaming Workflow

## Overview

Automated red-teaming integration using G0DM0D3 techniques.

## Integration

- Tool: `godmode` skill (red-teaming).
- Registry: Mapped to local `ollama-launch` models (qwen3.5:9b, deepseek-r1:14b).
- Workflow:
  1. Canary tests (step-by-step pick-a-lock).
  2. ULTRAPLINIAN model racing.
  3. Persistent jailbreak via config.yaml (system_prompt + prefill).

## Safety

- All red-teaming output is captured in `~/.hermes/logs/godmode.log`.
