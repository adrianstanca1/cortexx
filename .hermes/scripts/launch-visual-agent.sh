#!/bin/bash
# Visual Agent - llava:latest (local, vision capable)
hermes chat \
  --model llava:latest \
  --provider ollama-launch \
  --toolsets vision_analyze,image_generate,computer_use,file,terminal,skills \
  --skills architecture-diagram,ascii-art,design-md \
  --max-turns 100 \
  "$@"
