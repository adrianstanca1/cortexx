#!/bin/bash
# Redeployment script for CortexBuildPro on VPS
# Run this on your VPS to update to latest code

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

echo "🚀 Starting CortexBuildPro redeployment..."

# Change to script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Pull latest changes
echo "📥 Pulling latest code from GitHub..."
if ! git pull origin main; then
    echo "❌ Failed to pull latest code"
    exit 1
fi

# 2. Install/update dependencies
echo "📦 Installing dependencies..."
if ! npm ci; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# 3. Rebuild production assets
echo "🏗️  Building production assets..."
if ! npm run build; then
    echo "❌ Failed to build production assets"
    exit 1
fi

# 4. Restart the application
echo "🔄 Restarting application with PM2..."
# Kill any existing process first to avoid conflicts
pm2 delete cortexbuildpro 2>/dev/null || true

# Start the application with PM2
if ! pm2 start npm --name "cortexbuildpro" -- run start; then
    echo "❌ Failed to start application with PM2"
    exit 1
fi

# Save PM2 configuration for resurrection on reboot
pm2 save

# Setup PM2 to start on boot (if not already configured)
if ! pm2 startup | grep -q "sudo env PATH"; then
    echo "💡 To enable auto-start on boot, run:"
    echo "   sudo env PATH=\$PATH:/usr/local/bin pm2 startup systemd -u $USER --hp \$HOME"
fi

echo "✅ Redeployment complete!"
echo "🌐 Application should be available at:"
echo "   http://localhost:3000  (local)"
echo "   http://[your-vps-ip]:3000  (external)"
echo ""
echo "📊 To monitor the application:"
echo "   pm2 logs cortexbuildpro"
echo "   pm2 show cortexbuildpro"
echo ""
echo "🤖 To monitor Ollama resources:"
echo "   ollama ps"
echo "   ./workshop/monitor_ollama.sh 2>/dev/null || echo 'Workshop script not found'"
echo ""
echo "🔧 Management commands:"
echo "   pm2 restart cortexbuildpro    # Restart app"
echo "   pm2 stop cortexbuildpro       # Stop app"
echo "   pm2 delete cortexbuildpro     # Remove from PM2"
