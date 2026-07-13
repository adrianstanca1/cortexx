#!/usr/bin/env bash
set -euo pipefail

# Decrypt the env vault and export variables into the current shell.
# Usage: eval "$(./scripts/load-env.sh)"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="$REPO_ROOT/.env.vault"
KEY="${AGE_KEY:-$HOME/.config/cortexx/age.key}"

if [ ! -f "$VAULT" ]; then
  echo "export AGE_LOAD_ERROR='vault not found at $VAULT'" >&2
  exit 1
fi

if [ ! -f "$KEY" ]; then
  echo "export AGE_LOAD_ERROR='identity not found at $KEY'" >&2
  exit 1
fi

# Decrypt and emit export statements, skipping comments and blank lines.
age -d -i "$KEY" "$VAULT" | while IFS= read -r line; do
  case "$line" in
    ''|\#*) continue ;;
    *)
      key="${line%%=*}"
      value="${line#*=}"
      # Strip surrounding quotes if present.
      value="${value#\"}"
      value="${value%\"}"
      printf 'export %s="%s"\n' "$key" "$(printf '%s' "$value" | sed 's/"/\\"/g')"
      ;;
  esac
done
