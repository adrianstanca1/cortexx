#!/usr/bin/env python3
# flake8: noqa

"""
Deployment Agent
~~~~~~~~~~~~~~~~
Checks the health of the Node server and the Ollama model server.
Restarts them if needed, logging actions with timestamps to
`/workspace/.brain/deployment_agent.log`.
"""

import subprocess
import datetime
import os

# Path to the log file
LOG_PATH = "/workspace/.brain/deployment_agent.log"


def log(message: str) -> None:
    """Append a timestamped message to the log file."""
    timestamp = datetime.datetime.now().isoformat()
    # Ensure the log directory exists
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"{timestamp} - {message}\n")


def is_node_running() -> bool:
    """Return True if a Node process (node /workspace/server/index.js) is running."""
    try:
        # pgrep -f matches the full command line
        result = subprocess.run(
            ["pgrep", "-f", "node /workspace/server/index.js"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return result.returncode == 0
    except Exception as e:
        log(f"Error checking Node process: {e}")
        return False


def restart_node() -> None:
    """Attempt to restart the Node server via pm2."""
    try:
        result = subprocess.run(
            ["pm2", "restart", "node-server"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if result.returncode == 0:
            log("Node server restarted via pm2.")
        else:
            log(f"Failed to restart Node server via pm2: {result.stderr.strip()}")
    except FileNotFoundError:
        log("pm2 command not found; cannot restart Node server.")
    except Exception as e:
        log(f"Exception while restarting Node server: {e}")


def is_ollama_reachable() -> bool:
    """Check Ollama server health via its `/api/tags` endpoint.
    Returns True if HTTP 200 is received.
    """
    try:
        # Using curl to fetch HTTP status code only
        result = subprocess.run(
            [
                "curl",
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "http://127.0.0.1:11434/api/tags",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.stdout.strip() == "200"
    except Exception as e:
        log(f"Error checking Ollama server: {e}")
        return False


def restart_ollama() -> None:
    """Restart Ollama service. Prefer `systemctl`; fall back to `nohup` if unavailable."""
    # First attempt systemctl
    try:
        result = subprocess.run(
            ["systemctl", "restart", "ollama"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if result.returncode == 0:
            log("Ollama service restarted via systemctl.")
            return
        else:
            log(
                f"systemctl restart failed (rc={result.returncode}): {result.stderr.strip()}"
            )
    except FileNotFoundError:
        log("systemctl not found; falling back to nohup.")
    except Exception as e:
        log(f"Exception while restarting Ollama via systemctl: {e}")

    # Fallback: start Ollama with nohup in background
    try:
        # The command assumes `ollama` is in PATH and runs its server.
        # Redirect output to /dev/null and put in background.
        cmd = "nohup ollama serve > /dev/null 2>&1 &"
        subprocess.run(
            cmd,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        log("Ollama service started via nohup fallback.")
    except Exception as e:
        log(f"Exception while starting Ollama via nohup: {e}")


def main() -> None:
    # Check Node server
    if is_node_running():
        log("Node server is running.")
    else:
        log("Node server not running; attempting restart.")
        restart_node()

    # Check Ollama server
    if is_ollama_reachable():
        log("Ollama server is reachable.")
    else:
        log("Ollama server not reachable; attempting restart.")
        restart_ollama()


if __name__ == "__main__":
    main()
