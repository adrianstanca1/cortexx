#!/bin/bash
# CortexBuild Ultimate - Development Server Launcher
# Usage: ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_LOG="$PROJECT_DIR/logs/backend.log"
FRONTEND_LOG="$PROJECT_DIR/logs/frontend.log"
PID_DIR="$PROJECT_DIR/.pids"

mkdir -p "$PROJECT_DIR/logs" "$PID_DIR"

# ─── Stop existing ──────────────────────────────────────────────────
stop_servers() {
  echo "🛑 Stopping existing servers..."
  [ -f "$PID_DIR/backend.pid" ] && kill "$(cat "$PID_DIR/backend.pid")" 2>/dev/null || true
  [ -f "$PID_DIR/frontend.pid" ] && kill "$(cat "$PID_DIR/frontend.pid")" 2>/dev/null || true
  rm -f "$PID_DIR/backend.pid" "$PID_DIR/frontend.pid"
  sleep 1
}

# ─── Check prerequisites ───────────────────────────────────────────
check_prereqs() {
  echo "🔍 Checking prerequisites..."

  # Node.js
  if ! command -v node &>/dev/null; then
    echo "❌ Node.js not found"
    exit 1
  fi
  echo "  ✅ Node $(node -v)"

  # npm
  if ! command -v npm &>/dev/null; then
    echo "❌ npm not found"
    exit 1
  fi

  # Docker (for database)
  if command -v docker &>/dev/null; then
    if docker ps >/dev/null 2>&1; then
      DB_RUNNING=$(docker ps --filter 'name=cortexbuild-db' --format '{{.Names}}' 2>/dev/null)
      if [ -n "$DB_RUNNING" ]; then
        echo "  ✅ PostgreSQL (Docker)"
      else
        echo "  ⚠️  PostgreSQL container not running. Starting..."
        docker start cortexbuild-db 2>/dev/null || true
        docker start cortexbuild-redis 2>/dev/null || true
        sleep 3
      fi
    fi
  fi

  # Frontend deps
  if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "  📦 Installing frontend dependencies..."
    cd "$PROJECT_DIR" && npm install
  fi

  # Backend deps
  if [ ! -d "$PROJECT_DIR/server/node_modules" ]; then
    echo "  📦 Installing backend dependencies..."
    cd "$PROJECT_DIR/server" && npm install
  fi
}

# ─── Start backend ──────────────────────────────────────────────────
start_backend() {
  echo ""
  echo "🚀 Starting backend API on port 3001..."
  cd "$PROJECT_DIR/server"
  nohup node index.js > "$BACKEND_LOG" 2>&1 &
  echo $! > "$PID_DIR/backend.pid"
  BACKEND_PID=$!

  # Wait for backend to be ready
  for i in $(seq 1 10); do
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
      echo "  ✅ Backend ready (PID: $BACKEND_PID)"
      return 0
    fi
    sleep 1
  done
  echo "  ❌ Backend failed to start. Check $BACKEND_LOG"
  cat "$BACKEND_LOG"
  return 1
}

# ─── Start frontend ─────────────────────────────────────────────────
start_frontend() {
  echo ""
  echo "🎨 Starting frontend dev server on port 5173..."
  cd "$PROJECT_DIR"
  nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
  echo $! > "$PID_DIR/frontend.pid"
  FRONTEND_PID=$!

  # Wait for frontend to be ready
  for i in $(seq 1 15); do
    if curl -sI http://localhost:5173/ >/dev/null 2>&1; then
      echo "  ✅ Frontend ready (PID: $FRONTEND_PID)"
      return 0
    fi
    sleep 1
  done
  echo "  ❌ Frontend failed to start. Check $FRONTEND_LOG"
  cat "$FRONTEND_LOG"
  return 1
}

# ─── Main ───────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  CortexBuild Ultimate - Dev Launcher"
echo "============================================"
echo ""

# Handle stop command
if [ "$1" = "stop" ]; then
  stop_servers
  echo "✅ Servers stopped."
  exit 0
fi

# Handle restart
if [ "$1" = "restart" ]; then
  stop_servers
fi

# Handle status
if [ "$1" = "status" ]; then
  BACKEND_PID_FILE="$PID_DIR/backend.pid"
  FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

  if [ -f "$BACKEND_PID_FILE" ] && kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    echo "✅ Backend running (PID: $(cat "$BACKEND_PID_FILE"))"
  else
    echo "❌ Backend not running"
  fi

  if [ -f "$FRONTEND_PID_FILE" ] && kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
    echo "✅ Frontend running (PID: $(cat "$FRONTEND_PID_FILE"))"
  else
    echo "❌ Frontend not running"
  fi

  echo ""
  echo "  Backend:  http://localhost:3001/api/health"
  echo "  Frontend: http://localhost:5173"
  exit 0
fi

# Start everything
stop_servers
check_prereqs
start_backend
start_frontend

echo ""
echo "============================================"
echo "  ✅ CORTEXBUILD ULTIMATE IS RUNNING"
echo "============================================"
echo ""
echo "  🌐 Open: http://localhost:5173"
echo ""
echo "  📝 Demo login (see server/scripts/seed.sql after db reset):"
echo "     admin@cortexbuild.co.uk   or   adrian@cortexbuild.co.uk"
echo "     Password: CortexBuild2024!"
echo ""
echo "  🆕 Or register new account via 'Create Account'"
echo ""
echo "============================================"
echo "  Commands:"
echo "    ./start.sh stop      - Stop all servers"
echo "    ./start.sh restart   - Restart all servers"
echo "    ./start.sh status    - Check server status"
echo "    tail -f logs/backend.log   - Watch backend logs"
echo "    tail -f logs/frontend.log  - Watch frontend logs"
echo "============================================"
