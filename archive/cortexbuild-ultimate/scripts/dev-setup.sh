#!/usr/bin/env bash
# CortexBuild Ultimate - Development Environment Setup
# Usage: ./scripts/dev-setup.sh

set -euo pipefail

echo "🔧 Setting up development environment..."

# Check prerequisites
echo "1. Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }

# Install frontend deps
echo "2. Installing frontend dependencies..."
npm install --legacy-peer-deps

# Install backend deps
echo "3. Installing backend dependencies..."
cd server && npm install --legacy-peer-deps && cd ..

# Start Docker services
docker start cortexbuild-db 2>/dev/null || true
docker start cortexbuild-redis 2>/dev/null || true

# Wait for DB
echo "5. Waiting for PostgreSQL..."
sleep 5

# Check health
echo "6. Checking services..."
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "✅ Development environment ready!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
