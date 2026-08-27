#!/bin/bash
# Execution Agent - gemma4:26b-optimized-fixed (local, 262K context, coding capable)
hermes chat \
  --model gemma4:26b-optimized-fixed \
  --provider ollama-launch \
  --toolsets terminal,execute_code,file,patch,computer_use,coding,skills \
  --skills systematic-debugging,test-driven-development,simplify-code \
  --max-turns 300 \
  "$@"
