#!/bin/bash
# Planning Agent - gemma4:12b-optimized-fixed (local, 262K context, planning skills)
hermes chat \
  --model gemma4:12b-optimized-fixed \
  --provider ollama-launch \
  --toolsets plan,workflow-orchestrator,cronjob,delegation,todo,file,memory,skills \
  --skills plan,workflow-orchestrator,enhancement-guide \
  --max-turns 200 \
  "$@"
