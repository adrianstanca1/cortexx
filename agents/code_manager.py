#!/usr/bin/env python3
"""Run flake8 linting and pytest unit tests, capturing combined output
to a log file.

The script executes `flake8 .` and `pytest` in the repository root
(`/workspace`), captures their stdout and stderr, and writes the
concatenated result to `/workspace/.brain/code_manager.log`. It also
prints the combined output to the console for immediate visibility.
"""

import subprocess
from pathlib import Path


def run_flake8_and_pytest() -> None:
    """Execute flake8 and pytest, write their combined output to a log file.

    The function ensures that the target log directory exists, runs the two
    commands, captures both stdout and stderr, concatenates them with clear
    section headers, writes the result to the log file, and prints the output.
    """
    # Define log file location
    log_path = Path("/workspace/.brain/code_manager.log")
    # Ensure the parent directory exists
    log_path.parent.mkdir(parents=True, exist_ok=True)

    # Run flake8 on the repository root
    flake8_result = subprocess.run(
        ["flake8", "."],
        cwd="/workspace",
        capture_output=True,
        text=True,
    )

    # Run pytest on the repository root
    pytest_result = subprocess.run(
        ["pytest"],
        cwd="/workspace",
        capture_output=True,
        text=True,
    )

    # Build combined output with section headers
    combined_output = []
    combined_output.append("=== flake8 output ===")
    if flake8_result.stdout:
        combined_output.append(flake8_result.stdout)
    if flake8_result.stderr:
        combined_output.append(flake8_result.stderr)
    combined_output.append("=== pytest output ===")
    if pytest_result.stdout:
        combined_output.append(pytest_result.stdout)
    if pytest_result.stderr:
        combined_output.append(pytest_result.stderr)
    final_output = "\n".join(combined_output)

    # Write to log file
    log_path.write_text(final_output)

    # Also echo to stdout for immediate feedback
    print(final_output)


if __name__ == "__main__":
    run_flake8_and_pytest()
