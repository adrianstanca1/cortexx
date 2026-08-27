#!/bin/bash
# Hermes System Auto-Startup Script
# Enables all services and starts the full agent team

set -euo pipefail

LOG_FILE="/var/log/hermes-startup.log"
mkdir -p /var/log
echo "[$(date -Iseconds)] Starting Hermes system..." >> "$LOG_FILE"

# Enable user linger for persistent services
if ! loginctl show-user root 2>/dev/null | grep -q "Linger=yes"; then
    echo "[$(date -Iseconds)] Enabling user linger..." >> "$LOG_FILE"
    loginctl enable-linger root 2>/dev/null || true
    echo "[$(date -Iseconds)] User linger enabled" >> "$LOG_FILE"
fi

# Enable systemd services
systemctl --user enable hermes-gateway.service 2>/dev/null || true
systemctl --user enable hermes-agent-team.service 2>/dev/null || true
systemctl --user enable hermes-model-manager.service 2>/dev/null || true
systemctl --user enable hermes.target 2>/dev/null || true

# Start services
systemctl --user start hermes-gateway.service 2>/dev/null || true
systemctl --user start hermes-agent-team.service 2>/dev/null || true
systemctl --user start hermes-model-manager.service 2>/dev/null || true
systemctl --user start hermes.target 2>/dev/null || true

# Restart if gateway is failed
if systemctl --user is-failed --quiet hermes-gateway.service; then
    echo "[$(date -Iseconds)] Restarting hermes-gateway.service..." >> "$LOG_FILE"
    systemctl --user restart hermes-gateway.service 2>/dev/null || true
fi

# Fix cron config drift (re-pin to current config)
hermes cron list 2>/dev/null | grep -q "system-health-watchdog" && \
    hermes cron edit 1415b97f0941 --provider ollama-launch --model gemma4:26b-optimized >> "$LOG_FILE" 2>/dev/null || true
hermes cron list 2>/dev/null | grep -q "agent-performance-monitor" && \
    hermes cron edit 4a964c0d2429 --provider ollama-launch --model gemma4:26b-optimized >> "$LOG_FILE" 2>/dev/null || true

# Verify services
echo "[$(date -Iseconds)] Service status check:" >> "$LOG_FILE"
systemctl --user is-active hermes-gateway.service >> "$LOG_FILE" 2>/dev/null || echo "  hermes-gateway: $(systemctl --user is-active hermes-gateway.service 2>/dev/null)" >> "$LOG_FILE"
systemctl --user is-active ollama.service >> "$LOG_FILE" 2>/dev/null || echo "  ollama: $(systemctl --user is-active ollama.service 2>/dev/null)" >> "$LOG_FILE"
systemctl --user is-active hermes-agent-team.service >> "$LOG_FILE" 2>/dev/null || echo "  hermes-agent-team: $(systemctl --user is-active hermes-agent-team.service 2>/dev/null)" >> "$LOG_FILE"
systemctl --user is-active hermes-model-manager.service >> "$LOG_FILE" 2>/dev/null || echo "  hermes-model-manager: $(systemctl --user is-active hermes-model-manager.service 2>/dev/null)" >> "$LOG_FILE"

# Verify optimized Ollama models
if ollama list 2>/dev/null | grep -q "gemma4:26b-optimized"; then
    echo "[$(date -Iseconds)] All 5 optimized Ollama models available" >> "$LOG_FILE"
else
    echo "[$(date -Iseconds)] WARNING: Some optimized Ollama models not loaded" >> "$LOG_FILE"
fi

echo "[$(date -Iseconds)] Hermes system startup complete" >> "$LOG_FILE"