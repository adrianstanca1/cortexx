# Security

- The Agent OS API requires a strong CORTEX_AGENT_OS_TOKEN for every /api/* request. /health is intentionally public for liveness probes.
- Browser CORS is restricted to CORTEX_AGENT_OS_ORIGIN; native clients are not browser-CORS dependent.
- Web Mission Control stores the operator token in session storage only.
- Expo mobile stores its runtime connection URL/operator token in Expo SecureStore, never source code or AsyncStorage.
- Provider API keys remain server-side and are never embedded in mobile/web bundles.
- Default-deny for privileged execution.
- Tool permissions use ALLOW / ASK / DENY.
- Workspace path traversal is rejected.
- Catastrophic shell patterns are FORBIDDEN; elevated/destructive operations require explicit approval.
- Critical agent-to-agent delegations require an approval before model execution.
- Skill installation in the current registry installs trusted catalog metadata only; it does not execute arbitrary remote packages.
- Secrets come only from environment or a secret manager and must never be logged.
- Production deployments should use HTTPS, rate limiting and network policy in addition to the operator-token boundary.
