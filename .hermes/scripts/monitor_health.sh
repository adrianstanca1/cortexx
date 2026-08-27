#!/bin/bash
# Health monitoring script for continuous monitoring cron job

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3*100/$2}')
if [ "$MEM_USAGE" -gt 90 ]; then
    echo "WARNING: Memory usage is ${MEM_USAGE}%"
fi

# Check Ollama is running
if ! ollama list > /dev/null 2>&1; then
    echo "ERROR: Ollama is not responding"
fi

# Check Docker containers (if running)
if command -v docker > /dev/null 2>&1; then
    UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    if [ "$UNHEALTHY" -gt 0 ]; then
        echo "WARNING: $UNHEALTHY unhealthy Docker containers"
    fi
fi

# Check Hermes gateway (if running)
if ! curl -s http://127.0.0.1:8080/health > /dev/null 2>&1; then
    echo "INFO: Hermes gateway not accessible on port 8080"
fi

echo "Health check completed at $(date)"