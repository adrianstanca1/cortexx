#!/usr/bin/env bash
set -euo pipefail

# Decrypt the encrypted env vault into the current working directory as .env.
# The age identity is kept outside the repo at ~/.config/cortexx/age.key.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="$REPO_ROOT/.env.vault"
KEY="${AGE_KEY:-$HOME/.config/cortexx/age.key}"
OUT="${1:-$REPO_ROOT/.env}"

if [ ! -f "$VAULT" ]; then
  echo "Error: encrypted vault not found at $VAULT" >&2
  exit 1
fi

if [ ! -f "$KEY" ]; then
  echo "Error: age identity not found at $KEY" >&2
  echo "Set AGE_KEY to point to the private key or restore it from your password manager." >&2
  exit 1
fi

age -d -i "$KEY" -o "$OUT" "$VAULT"
echo "Decrypted $VAULT -> $OUT"
chmod 600 "$OUT"
