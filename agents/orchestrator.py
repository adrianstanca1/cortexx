#!/usr/bin/env python3
"""
Orchestrator script that monitors the agents registry for changes,
and logs heartbeat messages.

Logs are written to /workspace/.brain/orchestrator.log.
"""

import os
import time
from datetime import datetime

REGISTRY_PATH = "/workspace/.brain/agents_registry.md"
LOG_PATH = "/workspace/.brain/orchestrator.log"
CHECK_INTERVAL = 60  # seconds


def log(message: str):
    timestamp = datetime.now().isoformat()
    with open(LOG_PATH, "a") as f:
        f.write(f"[{timestamp}] {message}\n")


def main():
    # Initial modification time
    try:
        last_mtime = os.path.getmtime(REGISTRY_PATH)
    except FileNotFoundError:
        last_mtime = None
        log("agents_registry.md not found at startup.")

    log("Orchestrator started.")
    while True:
        # Heartbeat
        log("heartbeat")

        # Check for changes
        try:
            current_mtime = os.path.getmtime(REGISTRY_PATH)
            if last_mtime is None:
                # Previously missing, now exists
                log("agents_registry.md created.")
                last_mtime = current_mtime
            elif current_mtime != last_mtime:
                log("agents_registry.md changed.")
                last_mtime = current_mtime
        except FileNotFoundError:
            if last_mtime is not None:
                log("agents_registry.md deleted.")
                last_mtime = None

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    # Ensure the script is executable (chmod +x)
    try:
        current_mode = os.stat(__file__).st_mode
        os.chmod(__file__, current_mode | 0o111)
    except Exception as e:
        # Log any chmod errors to orchestrator log but continue execution
        try:
            with open(LOG_PATH, "a") as _log_f:
                timestamp = datetime.now().isoformat()
                _log_f.write(f"[{timestamp}] chmod error: {e}\n")
        except Exception:
            pass
    main()
