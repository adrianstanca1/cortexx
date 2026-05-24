#!/usr/bin/env python3
"""Write .env for docker-compose interpolation from a running API container (run on VPS)."""
import json
import os
import subprocess
import sys

container = sys.argv[1] if len(sys.argv) > 1 else "cortexbuild-api"
out_path = sys.argv[2] if len(sys.argv) > 2 else "/root/cortexbuild-ultimate/.env"

raw = subprocess.check_output(["docker", "inspect", container], text=True)
cfg = json.loads(raw)[0]["Config"]["Env"]
env: dict[str, str] = {}
for line in cfg:
    if "=" in line:
        k, _, v = line.partition("=")
        env[k] = v

lines = [
    "POSTGRES_PASSWORD=" + env.get("DB_PASSWORD", ""),
    "POSTGRES_USER=cortexbuild",
    "POSTGRES_DB=cortexbuild",
    "JWT_SECRET=" + env.get("JWT_SECRET", ""),
    "SESSION_SECRET=" + env.get("SESSION_SECRET", ""),
    "CORS_ORIGIN=" + env.get("CORS_ORIGIN", "https://www.cortexbuildpro.com,https://cortexbuildpro.com"),
    "FRONTEND_URL=" + env.get("FRONTEND_URL", "https://www.cortexbuildpro.com"),
    "GOOGLE_CLIENT_ID=" + env.get("GOOGLE_CLIENT_ID", ""),
    "GOOGLE_CLIENT_SECRET=" + env.get("GOOGLE_CLIENT_SECRET", ""),
    "GOOGLE_CALLBACK_URL=" + env.get("GOOGLE_CALLBACK_URL", ""),
]

with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
os.chmod(out_path, 0o600)
print("wrote", out_path, "size", os.path.getsize(out_path))
