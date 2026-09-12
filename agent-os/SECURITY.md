# Security

- Default-deny for privileged execution.
- Tool permissions use ALLOW / ASK / DENY.
- Workspace path traversal is rejected.
- Catastrophic shell patterns are FORBIDDEN; elevated/destructive operations require explicit approval in future shell adapters.
- Secrets come only from environment or a secret manager and must never be logged.
- Production deployments should put the API behind HTTPS, authentication, rate limiting and network policy.
- The mobile app must never embed provider API keys; it talks only to Cortex Agent OS.