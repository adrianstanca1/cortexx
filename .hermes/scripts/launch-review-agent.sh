#!/bin/bash
# Review Agent - gemma4:12b-optimized-fixed (local, 262K context, review skills)
hermes chat \
  --model gemma4:12b-optimized-fixed \
  --provider ollama-launch \
  --toolsets file,skills,terminal,execute_code,web \
  --skills requesting-code-review,github-code-review,systematic-debugging \
  --max-turns 150 \
  "$@"
