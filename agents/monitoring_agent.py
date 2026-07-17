#!/usr/bin/env python3
"""
Monitoring Agent

This script runs indefinitely, sending an HTTP GET request to
https://api.cortexbuildpro.com/health every 30 seconds. It logs the ISO
timestamp, HTTP status code, and response time (in milliseconds) to
/workspace/.brain/monitoring.log.

The script ensures its own executable permission on start via
os.chmod(__file__, 0o755). Errors from the requests library are caught and
logged with an "ERROR" marker.
"""

import os
import time
import datetime
import requests

# Make this script executable (runtime permission change as requested)
script_path = os.path.abspath(__file__)
os.chmod(script_path, 0o755)

# Log file path
LOG_FILE = "/workspace/.brain/monitoring.log"
# Ensure the directory for the log file exists
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

# Target URL
HEALTH_URL = "https://api.cortexbuildpro.com/health"


def log(message: str) -> None:
    """Append a message to the monitoring log with a newline."""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(message + "\n")


def monitor() -> None:
    while True:
        start_time = time.time()
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            response = requests.get(HEALTH_URL, timeout=10)
            # Calculate response time in milliseconds
            elapsed_ms = int((time.time() - start_time) * 1000)
            log_line = f"{timestamp} {response.status_code} {elapsed_ms}"
        except requests.RequestException as exc:
            elapsed_ms = int((time.time() - start_time) * 1000)
            # Log the exception type and message
            log_line = f"{timestamp} ERROR {elapsed_ms} {type(exc).__name__}: {exc}"
        log(log_line)
        # Wait 30 seconds before the next request
        time.sleep(30)


if __name__ == "__main__":
    try:
        monitor()
    except KeyboardInterrupt:
        # Graceful shutdown on Ctrl+C
        print("Monitoring agent stopped by user.")
