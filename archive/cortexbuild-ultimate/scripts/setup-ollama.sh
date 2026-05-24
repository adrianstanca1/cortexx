#!/bin/bash

set -e

MODEL="${OLLAMA_MODEL:-llama3.2}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "=== Ollama Setup Script ==="
echo "Model: $MODEL"
echo "Host: $OLLAMA_HOST"
echo ""

echo "Step 1: Checking if Ollama is installed..."
if ! command -v ollama &> /dev/null; then
    echo "ERROR: Ollama is not installed."
    echo "Install with: brew install ollama"
    exit 1
fi
echo "Ollama is installed."

echo ""
echo "Step 2: Checking if Ollama server is running..."
if curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_HOST/api/tags" 2>/dev/null | grep -q "200"; then
    echo "Ollama server is running at $OLLAMA_HOST"
else
    echo "Ollama server is not running. Starting it..."
    ollama serve &
    OLLAMA_PID=$!
    
    echo "Waiting for Ollama to start..."
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_HOST/api/tags" 2>/dev/null | grep -q "200"; then
            echo "Ollama server is now running."
            break
        fi
        sleep 1
    done
    
    if ! curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_HOST/api/tags" 2>/dev/null | grep -q "200"; then
        echo "ERROR: Failed to start Ollama server."
        exit 1
    fi
fi

echo ""
echo "Step 3: Checking if model $MODEL is available..."
curl -s "$OLLAMA_HOST/api/tags" | grep -q "\"name\".*$MODEL" && {
    echo "Model $MODEL is already available."
} || {
    echo "Model $MODEL is not downloaded. Pulling now..."
    echo "This may take several minutes depending on your internet connection."
    
    ollama pull "$MODEL"
    
    if [ $? -eq 0 ]; then
        echo "Model $MODEL pulled successfully."
    else
        echo "ERROR: Failed to pull model $MODEL."
        exit 1
    fi
}

echo ""
echo "Step 4: Testing connection..."
RESPONSE=$(curl -s "$OLLAMA_HOST/api/tags")
if echo "$RESPONSE" | grep -q "models"; then
    echo "Connection test successful!"
    echo ""
    echo "Available models:"
    echo "$RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g; s/"//g' | while read -r model; do
        echo "  - $model"
    done
else
    echo "ERROR: Connection test failed."
    exit 1
fi

echo ""
echo "Step 5: Testing model inference..."
TEST_PROMPT="Respond with just the word 'OK' if you can understand this."

echo "$TEST_PROMPT" | ollama run "$MODEL" 2>/dev/null | grep -q "OK" && {
    echo "Model inference test successful!"
} || {
    echo "WARNING: Model inference test may have failed."
    echo "Trying alternative test..."
    
    RESULT=$(curl -s -X POST "$OLLAMA_HOST/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"$MODEL\", \"prompt\": \"$TEST_PROMPT\", \"stream\": false}")
    
    if echo "$RESULT" | grep -q "OK"; then
        echo "Model inference test successful (via API)!"
    else
        echo "WARNING: Could not verify model inference. You may need to test manually."
    fi
}

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To use Ollama in your project, ensure the server is running:"
echo "  ollama serve"
echo ""
echo "To run the AI agents:"
echo "  npx ts-node scripts/ai-agents.ts"
echo ""
echo "Environment variables (optional):"
echo "  OLLAMA_MODEL=$MODEL"
echo "  OLLAMA_HOST=$OLLAMA_HOST"
