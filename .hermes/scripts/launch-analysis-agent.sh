#!/bin/bash
# Analysis Agent - mistral:7b-optimized-fixed (local, 32K context, tools capable)
hermes chat \
  --model mistral:7b-optimized-fixed \
  --provider ollama-launch \
  --toolsets execute_code,file,terminal,memory,skills \
  --skills data-analysis,usage-analytics,evaluating-llms-harness \
  --max-turns 150 \
  "$@"
