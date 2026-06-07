#!/bin/bash
export OLLAMA_API_BASE="http://127.0.0.1:11434"

# Create a local aider configuration file specifically for Ollama
cat << 'CONFIG' > .aider.conf.yml
model: ollama/qwen2.5-coder:7b
editor-model: ollama/qwen2.5-coder:7b
weak-model: ollama/qwen2.5:3b
map-tokens: 2048
dark-mode: true
yes-always: true
analytics: false
CONFIG

echo "Local Aider Configuration Generated."
