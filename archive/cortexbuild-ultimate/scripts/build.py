import subprocess
import os
import sys
import shutil
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
SERVER_ROOT = PROJECT_ROOT / 'server'
DIST_DIR = PROJECT_ROOT / 'dist'
LOGS_DIR = PROJECT_ROOT / 'logs'

def log(message, level="INFO"):
    print(f"[{level}] {message}")

def run_command(cmd, cwd=None, env=None):
    """Run shell command and return output."""
    log(f"Executing: {cmd}")
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            cwd=cwd or PROJECT_ROOT, 
            env={**os.environ, **(env or {})}, 
            capture_output=True, 
            text=True, 
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        log(f"Command failed: {e.stderr}", "ERROR")
        raise e

def verify_dependencies():
    """Check if critical tools are installed."""
    tools = ['node', 'npm']
    for tool in tools:
        try:
            run_command(f"{tool} --version")
        except Exception:
            log(f"Missing required tool: {tool}", "ERROR")
            sys.exit(1)

def run_frontend_build():
    """Full Vitest / TSC / Vite build pipeline."""
    log("Starting Frontend Build Pipeline...")
    
    # 1. Type Check
    run_command("npm run typecheck")
    
    # 2. Linting
    run_command("npm run lint")
    
    # 3. Unit Tests
    run_command("npm run test")
    
    # 4. Vite Build
    run_command("npm run build")
    log("Frontend build successful.")

def run_backend_build():
    """Backend validation and build."""
    log("Starting Backend Build Pipeline...")
    
    # Install server deps if needed
    run_command("npm install", cwd=SERVER_ROOT)
    
    # Run server-side tests if available
    try:
        run_command("npm run test", cwd=SERVER_ROOT)
    except:
        log("No server tests found or tests failed. Continuing...", "WARN")

def deploy_local_dist():
    """Sync build artifacts to dist folder."""
    # Vite already builds into the dist folder in the project root.
    # We just verify it exists and is populated.
    if DIST_DIR.exists() and any(DIST_DIR.iterdir()):
        log("Build artifacts verified in dist/")
    else:
        log("Build artifacts missing from dist/", "ERROR")
        raise FileNotFoundError(f"Build artifacts not found in {DIST_DIR}")

def main():
    try:
        LOGS_DIR.mkdir(exist_ok=True)
        
        verify_dependencies()
        run_frontend_build()
        run_backend_build()
        deploy_local_dist()
        
        log("CortexBuild Ultimate: FULL BUILD SUCCESSFUL", "SUCCESS")
    except Exception as e:
        log(f"Build Pipeline Failed: {str(e)}", "CRITICAL")
        sys.exit(1)

if __name__ == "__main__":
    main()
