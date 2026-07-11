# System Architecture (Optimized)
**Date:** 2026-06-07
**Application:** Cortexx (Production v1.0.0)
**Infrastructure:** Hostinger VPS (72.62.132.43)

## Optimized Inference Stack
| Service | Port | Model | Role |
| :--- | :--- | :--- | :--- |
| **Ollama** | 11434 | llama3.2:3b | Base / Fallback |
| **Native Text** | 8085 | qwen2.5-coder:7b | High-throughput Code/Text |
| **Native Vision** | 8086 | moondream | Real-time SNAG/Photo Analysis |

## Deployment Pipeline
- **CI**: Passing (Lint, Typecheck, Integration Tests).
- **CD**: Fully automated with aggressive Prisma self-healing (auto-resolve drifted schemas).
