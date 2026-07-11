#!/bin/sh
# CortexBuild Pro — Ollama init: start the server, pull the default model once.
# Runs as the ollama container entrypoint so the AI works on first boot
# with zero manual steps.
set -e

# Start the Ollama server in the background
ollama serve &
SERVER_PID=$!

# Wait for it to accept connections
echo "[ollama-init] waiting for server…"
until ollama list >/dev/null 2>&1; do sleep 1; done

MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
VISION="${OLLAMA_VISION_MODEL:-}"

# Pull the chat model if not already present
if ! ollama list | grep -q "${MODEL%%:*}"; then
	echo "[ollama-init] pulling ${MODEL} (one-time, ~2GB)…"
	ollama pull "$MODEL" || echo "[ollama-init] WARN: pull failed; AI will retry on first request"
else
	echo "[ollama-init] ${MODEL} already present"
fi

# Optionally pull a vision model (for photo-as-mention / receipt OCR)
if [ -n "$VISION" ] && ! ollama list | grep -q "${VISION%%:*}"; then
	echo "[ollama-init] pulling vision model ${VISION}…"
	ollama pull "$VISION" || echo "[ollama-init] WARN: vision pull failed (optional)"
fi

echo "[ollama-init] ready."
# Hand the foreground back to the server process
wait $SERVER_PID
