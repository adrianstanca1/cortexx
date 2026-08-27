#!/bin/bash
# Research Agent - llama3.2:3b-optimized-fixed (local, fast, 128K context)
hermes chat \
  --model llama3.2:3b-optimized-fixed \
  --provider ollama-launch \
  --toolsets web,browser,file,memory,session_search,skills \
  --skills web-scraper,blogwatcher,competitor-news-monitor \
  --max-turns 100 \
  "$@"
