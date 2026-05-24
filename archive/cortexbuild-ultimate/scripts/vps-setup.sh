#!/usr/bin/env bash
# VPS Setup Script - Configure production server
# Usage: ssh root@VPS_IP < scripts/vps-setup.sh

set -euo pipefail

echo "🔧 Setting up VPS environment..."

# Pull additional Ollama models for production
echo "1. Pulling Ollama models for production..."
docker exec cortexbuild-ollama ollama pull qwen3.5:0.8b &
echo "   Started qwen3.5:0.8b pull (background)"

# Restart API with latest code
echo "2. Restarting CortexBuild API..."
cd /var/www/cortexbuild-ultimate
git pull origin main
docker restart cortexbuild-api

# Wait for API
echo "3. Waiting for API..."
sleep 8
curl -s http://127.0.0.1:3001/api/health

# Clean Docker
echo "4. Cleaning Docker..."
docker system prune -f

echo ""
echo "✅ VPS setup complete!"
