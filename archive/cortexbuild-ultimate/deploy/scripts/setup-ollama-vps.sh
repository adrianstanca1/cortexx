#!/bin/bash
# Ollama setup script for VPS
# Run this on your VPS to install and configure Ollama for CortexBuildPro

set -euo pipefail

echo "🤖 Setting up Ollama for CortexBuildPro on VPS..."

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
else
    echo "📥 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "✅ Ollama installed successfully"
fi

# Start Ollama service
echo "🚀 Starting Ollama service..."
# Ollama typically runs as a background service that starts on boot
# We'll start it and ensure it's running in the background
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama in background..."
    nohup ollama serve > /var/log/ollama.log 2>&1 &
    # Give it a moment to start
    sleep 3
    
    # Verify it's running
    if ! pgrep -x "ollama" > /dev/null; then
        echo "❌ Failed to start Ollama service"
        exit 1
    fi
    echo "✅ Ollama service started"
else
    echo "✅ Ollama is already running"
fi

# Pull the required model
echo "📥 Pulling required AI model: qwen3.5:latest"
echo "⏳ This may take several minutes depending on your connection..."
if ! ollama pull qwen3.5:latest; then
    echo "❌ Failed to pull model qwen3.5:latest"
    echo "💡 You can try a smaller model like: ollama pull llama3.2:3b"
    exit 1
fi
echo "✅ Model qwen3.5:latest pulled successfully"

# Verify the model is available
echo "📋 Available models:"
ollama list

# Test the model with a simple query
echo "🧪 Testing model with a simple query..."
if ollama run qwen3.5:latest "Say 'Hello, CortexBuildPro!' in one sentence."; then
    echo "✅ Model test successful"
else
    echo "⚠️  Model test had issues, but model is available"
fi

# Set up auto-start for Ollama (if not already configured)
echo ""
echo "🔧 To ensure Ollama starts automatically on boot:"
echo "   The installation script should have already set this up"
echo "   You can verify with: systemctl is-enabled ollama (if using systemd)"
echo "   Or check your startup applications"

echo ""
echo "🎉 Ollama setup complete!"
echo ""
echo "📝 Next steps for CortexBuildPro:"
echo "   1. Deploy the application using: ./redeploy_script.sh"
echo "   2. The app will automatically use Ollama for AI features"
echo "   3. Monitor with: ollama ps"
echo ""
echo "💡 Tips:"
echo "   - First model load will be slower (cold start)"
echo "   - Subsequent requests will be much faster"
echo "   - Monitor memory usage: ollama ps shows memory consumption"
