#!/bin/bash
# Verify all Hermes Agent setup is complete and working

echo "=== Hermes Agent Setup Verification ==="
echo ""

# 1. Check optimized Ollama models
echo "1. Checking optimized Ollama models..."
MODELS=("gemma4:12b-optimized-fixed" "gemma4:26b-optimized-fixed" "llama3.2:3b-optimized-fixed" "mistral:7b-optimized-fixed" "phi3:mini-optimized-fixed" "llava:latest")
for model in "${MODELS[@]}"; do
    if ollama list | grep -q "$model"; then
        echo "   ✓ $model"
    else
        echo "   ✗ $model MISSING"
    fi
done
echo ""

# 2. Verify config.yaml has correct model names
echo "2. Verifying config.yaml model references..."
if grep -q "gemma4:12b-optimized-fixed" /root/.hermes/config.yaml && \
   grep -q "gemma4:26b-optimized-fixed" /root/.hermes/config.yaml && \
   grep -q "llama3.2:3b-optimized-fixed" /root/.hermes/config.yaml && \
   grep -q "mistral:7b-optimized-fixed" /root/.hermes/config.yaml && \
   grep -q "phi3:mini-optimized-fixed" /root/.hermes/config.yaml; then
    echo "   ✓ All model references updated in config.yaml"
else
    echo "   ✗ Some model references missing in config.yaml"
fi
echo ""

# 3. Check API keys in .env
echo "3. Checking critical API keys..."
CRITICAL_KEYS=("NVIDIA_API_KEY" "OPENROUTER_API_KEY" "GOOGLE_API_KEY" "EXA_API_KEY" "TAVILY_API_KEY" "FAL_KEY" "BROWSERBASE_API_KEY" "TELEGRAM_BOT_TOKEN")
for key in "${CRITICAL_KEYS[@]}"; do
    if grep -q "^${key}=" /root/.hermes/.env 2>/dev/null && ! grep -q "^${key}=$" /root/.hermes/.env 2>/dev/null; then
        echo "   ✓ $key"
    else
        echo "   ⚠ $key (not set or empty)"
    fi
done
echo ""

# 4. Check cron jobs
echo "4. Checking cron jobs..."
JOBS=$(cronjob list 2>/dev/null | jq -r '.jobs[] | "\(.job_id) \(.model) \(.provider)"' 2>/dev/null)
if echo "$JOBS" | grep -q "optimized-fixed"; then
    echo "   ✓ Cron jobs using fixed models"
    echo "$JOBS" | while read id model provider; do
        echo "     $id: $model ($provider)"
    done
else
    echo "   ⚠ Cron jobs may not be updated"
fi
echo ""

# 5. Check systemd services
echo "5. Checking systemd services..."
SERVICES=("hermes-auto-start.service" "hermes-gateway.service" "hermes-agent-team.service" "hermes-model-manager.service" "ollama.service")
for svc in "${SERVICES[@]}"; do
    if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
        STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
        echo "   ✓ $svc (enabled, $STATUS)"
    else
        echo "   ✗ $svc (not enabled)"
    fi
done
echo ""

# 6. Run model health check
echo "6. Running model health check..."
python3 /root/.hermes/scripts/model-manager.py check-all 2>&1 | tail -15
echo ""

# 7. Test agent model resolution
echo "7. Testing agent model resolution..."
python3 /root/.hermes/scripts/model-manager.py agent-model research
python3 /root/.hermes/scripts/model-manager.py agent-model analysis
python3 /root/.hermes/scripts/model-manager.py agent-model planning
python3 /root/.hermes/scripts/model-manager.py agent-model execution
python3 /root/.hermes/scripts/model-manager.py agent-model review
python3 /root/.hermes/scripts/model-manager.py agent-model visual
echo ""

echo "=== Verification Complete ==="
