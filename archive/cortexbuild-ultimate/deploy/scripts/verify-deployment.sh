#!/bin/bash
# Verification script for CortexBuildPro VPS deployment

set -euo pipefail

echo "🔍 Verifying CortexBuildPro VPS deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the cortexbuildpro directory"
    exit 1
fi

echo "📋 Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js version: $(node --version)"
else
    echo "❌ Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    echo "✅ npm version: $(npm --version)"
else
    echo "❌ npm not found"
    exit 1
fi

# Check git
if command -v git &> /dev/null; then
    echo "✅ git available"
else
    echo "❌ git not found"
    exit 1
fi

echo ""
echo "🔧 Checking application readiness..."

# Check if dependencies are installed
if [ -d "node_modules" ] && [ -d "server/node_modules" ]; then
    echo "✅ Dependencies appear to be installed"
else
    echo "⚠️  Dependencies may need to be installed (run: npm ci && cd server && npm ci)"
fi

# Check if build exists
if [ -d "dist" ]; then
    echo "✅ Build directory exists"
else
    echo "⚠️  Build directory missing (run: npm run build)"
fi

# Check environment file
if [ -f ".env" ]; then
    echo "✅ Environment file exists"
    # Check for key variables
    if grep -q "OLLAMA_HOST" .env && grep -q "DEFAULT_AI_PROVIDER" .env; then
        echo "✅ Ollama configuration found in .env"
    else
        echo "⚠️  Ollama configuration may be incomplete in .env"
    fi
else
    echo "❌ Environment file missing (copy .env.example to .env and configure)"
fi

echo ""
echo "🚀 Testing application startup (quick check)..."
echo "⏳ This will start the app briefly and then stop it..."

# Start the app in background for a quick test
timeout 15 bash -c "
    echo 'Starting server for health check...'
    npm run start &
    SERVER_PID=\$!
    sleep 5
    if curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3000/ | grep -q \"2\|3\"; then
        echo '✅ Application is responding'
    else
        echo '❌ Application is not responding properly'
    fi
    kill \$SERVER_PID 2>/dev/null || true
" || echo "⚠️  Application test timed out or failed"

echo ""
echo "🤖 Checking Ollama availability..."
if command -v ollama &> /dev/null; then
    if ollama ps > /dev/null 2>&1; then
        echo "✅ Ollama is running"
        echo "📋 Models available:"
        ollama list
    else
        echo "⚠️  Ollama command found but service may not be running"
        echo "💡 Try: ollama serve & (in background) or check installation"
    fi
else
    echo "❌ Ollama not installed"
    echo "💡 Run: ./setup_ollama_vps.sh to install"
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Fix any issues identified above"
echo "   2. Deploy to VPS: ./redeploy_script.sh"
echo "   3. Setup Ollama (if needed): ./setup_ollama_vps.sh"
echo "   4. Verify deployment: curl http://your-vps-ip:3000"
echo ""
echo "🔧 Useful commands:"
echo "   npm run dev          # Start in development mode"
echo "   npm run build        # Build for production"
echo "   npm run start        # Start production server"
echo "   ./vps_health_check.sh # Comprehensive health check (on VPS)"
