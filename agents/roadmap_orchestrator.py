#!/usr/bin/env python3
"""Roadmap Orchestrator

This script launches and monitors four agent subprocesses, restarts any that exit
unexpectedly, and periodically scans the roadmap for pending tasks marked with
the 🚧 emoji. For each such task it logs the description and creates a pending
TODO entry via the ``todo`` CLI tool, avoiding duplicate entries.

Features:
- Self‑chmod to make the file executable.
- Graceful shutdown on SIGINT/SIGTERM.
- Persistent tracking of created TODO entries to prevent duplication.
- Logging to ``/workspace/.brain/roadmap_orchestrator.log``.
"""

import os
import sys
import stat
import subprocess
import time
import signal
import threading
import logging
import json

# ---------------------------------------------------------------------------
# Self‑chmod routine – make this script executable for the user.
# ---------------------------------------------------------------------------
script_path = os.path.abspath(__file__)
try:
    st = os.stat(script_path)
    # Grant execute permission to user, group, others while preserving existing bits.
    os.chmod(
        script_path, st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    )
except Exception as exc:  # pragma: no cover – best‑effort only.
    print(
        f"Failed to set executable bit on {script_path}: {exc}",
        file=sys.stderr,
    )

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_DIR = "/workspace"
AGENTS_DIR = os.path.join(BASE_DIR, "agents")
LOG_PATH = os.path.join(BASE_DIR, ".brain", "roadmap_orchestrator.log")
TODO_CACHE_PATH = os.path.join(
    BASE_DIR, ".brain", "roadmap_orchestrator_todos.json"
)
ROADMAP_PATH = os.path.join(BASE_DIR, "cortexx", "ROADMAP.md")

# Ensure directories exist.
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
os.makedirs(os.path.dirname(TODO_CACHE_PATH), exist_ok=True)

# ---------------------------------------------------------------------------
# Logging setup – both to file and stdout for visibility.
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout),
    ],
)

# Global flag to indicate the orchestrator is running.
_running = True


# ---------------------------------------------------------------------------
# Helper utilities for persisting known TODO descriptions (to avoid duplicates).
# ---------------------------------------------------------------------------
def _load_known_tasks() -> set:
    """Load the set of task descriptions that have already been sent to ``todo``.
    Returns an empty set on failure or if the cache file does not exist.
    """
    if os.path.exists(TODO_CACHE_PATH):
        try:
            with open(TODO_CACHE_PATH, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                return set(data)
        except (
            Exception
        ):  # pragma: no cover – log and continue with empty set.
            logging.exception(
                "Failed to read TODO cache; starting with empty set"
            )
    return set()


def _save_known_tasks(tasks: set) -> None:
    """Write the current set of known task descriptions to the cache file."""
    try:
        with open(TODO_CACHE_PATH, "w", encoding="utf-8") as fp:
            json.dump(sorted(tasks), fp, ensure_ascii=False, indent=2)
    except Exception:  # pragma: no cover – log but do not crash.
        logging.exception("Failed to write TODO cache file")


_known_tasks = _load_known_tasks()
_tasks_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Agent management – launch, monitor and restart processes.
# ---------------------------------------------------------------------------
AGENT_SCRIPTS = {
    "orchestrator": os.path.join(AGENTS_DIR, "orchestrator.py"),
    "code_manager": os.path.join(AGENTS_DIR, "code_manager.py"),
    "deployment_agent": os.path.join(AGENTS_DIR, "deployment_agent.py"),
    "monitoring_agent": os.path.join(AGENTS_DIR, "monitoring_agent.py"),
}

# Store the subprocess.Popen objects keyed by the logical name.
_processes: dict[str, subprocess.Popen] = {}


def _start_agent(name: str, path: str) -> subprocess.Popen | None:
    """Start an agent script using the current Python interpreter.
    Returns the Popen object or ``None`` on failure.
    """
    try:
        proc = subprocess.Popen([sys.executable, path])
        logging.info(f"Started {name} (pid {proc.pid})")
        return proc
    except Exception:
        logging.exception(f"Failed to start {name} (path={path})")
        return None


def _monitor_agent(name: str, path: str) -> None:
    """Continuously watch a single agent process, restarting it if it exits.
    This runs in its own daemon thread.
    """
    global _processes
    # Ensure an initial instance is running.
    if _processes.get(name) is None:
        _processes[name] = _start_agent(name, path)
    while _running:
        proc = _processes.get(name)
        if proc is None:
            # Unexpected loss of the process object – start anew.
            _processes[name] = _start_agent(name, path)
            proc = _processes[name]
        retcode = proc.poll()
        if retcode is not None:
            # Process terminated; log and restart.
            logging.warning(
                f"{name} exited with return code {retcode}. Restarting..."
            )
            _processes[name] = _start_agent(name, path)
        time.sleep(5)  # poll interval – keep the thread lightweight.


# ---------------------------------------------------------------------------
# ROADMAP watcher – extracts 🚧 tasks every 60 seconds and creates TODOs.
# ---------------------------------------------------------------------------
def _parse_roadmap_line(line: str) -> str | None:
    """Return the description text after the leading 🚧 emoji, stripped.
    If the line does not start with the emoji, ``None`` is returned.
    """
    stripped = line.lstrip()
    # Directly compare against the Unicode emoji for reliability across builds.
    if stripped.startswith("🚧"):
        # Remove the emoji and any surrounding whitespace.
        return stripped.lstrip("🚧").strip()
    return None


def _process_roadmap() -> None:
    """Read the roadmap file and ensure each 🚧 entry has a pending TODO.
    Duplicate entries are ignored using the persisted ``_known_tasks`` set.
    """
    if not os.path.exists(ROADMAP_PATH):
        logging.debug(
            f"Roadmap file not found at {ROADMAP_PATH}; skipping this cycle"
        )
        return
    try:
        with open(ROADMAP_PATH, "r", encoding="utf-8") as fp:
            for raw_line in fp:
                description = _parse_roadmap_line(raw_line)
                if description:
                    with _tasks_lock:
                        if description in _known_tasks:
                            continue  # Already recorded.
                        # Log the discovery.
                        logging.info(f"Roadmap task detected: {description}")
                        # Create a TODO via the external ``todo`` tool.
                        try:
                            subprocess.run(
                                [
                                    "todo",
                                    "add",
                                    description,
                                    "--status",
                                    "pending",
                                ],
                                check=False,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                            )
                        except Exception:
                            logging.exception(
                                f"Failed to invoke todo for: {description}"
                            )
                        # Remember the task to avoid future duplication.
                        _known_tasks.add(description)
                        _save_known_tasks(_known_tasks)
    except Exception:
        logging.exception("Error while scanning ROADMAP.md")


def _roadmap_watcher() -> None:
    """Thread target – runs ``_process_roadmap`` every 60 seconds.
    The loop stops when ``_running`` becomes ``False``.
    """
    while _running:
        start = time.time()
        _process_roadmap()
        # Sleep the remainder of the minute, but break early if we are shutting down.
        elapsed = time.time() - start
        remaining = max(0, 60 - elapsed)
        for _ in range(int(remaining)):
            if not _running:
                break
            time.sleep(1)


# ---------------------------------------------------------------------------
# Signal handling – graceful shutdown of child processes.
# ---------------------------------------------------------------------------
def _handle_signal(
    signum, frame
) -> None:  # pragma: no cover – exercised by runtime.
    global _running
    logging.info(f"Received signal {signum} – initiating shutdown")
    _running = False
    # Attempt graceful termination of all child agents.
    for name, proc in list(_processes.items()):
        if proc.poll() is None:
            try:
                logging.info(f"Terminating {name} (pid {proc.pid})")
                proc.terminate()
            except Exception:
                logging.exception(f"Failed to terminate {name}")
    # Give them a short window to exit cleanly.
    time.sleep(2)
    # Force‑kill any that remain.
    for name, proc in list(_processes.items()):
        if proc.poll() is None:
            try:
                logging.info(f"Killing {name} (pid {proc.pid})")
                proc.kill()
            except Exception:
                logging.exception(f"Failed to kill {name}")
    logging.info("Shutdown complete. Exiting.")
    sys.exit(0)


# ---------------------------------------------------------------------------
# Main entry point.
# ---------------------------------------------------------------------------
def main() -> None:
    # Register signal handlers for graceful exit.
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    # Spawn a monitoring thread for each agent.
    for name, path in AGENT_SCRIPTS.items():
        t = threading.Thread(
            target=_monitor_agent, args=(name, path), daemon=True
        )
        t.start()

    # Spawn the roadmap watcher thread.
    roadmap_thread = threading.Thread(target=_roadmap_watcher, daemon=True)
    roadmap_thread.start()

    # Keep the main thread alive while the orchestrator runs.
    try:
        while _running:
            time.sleep(1)
    except KeyboardInterrupt:
        # Fallback for environments where signals may not be delivered.
        _handle_signal(signal.SIGINT, None)


if __name__ == "__main__":
    main()
