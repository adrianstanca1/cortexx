#!/usr/bin/env bash
set -euo pipefail

# Authenticate gh CLI with the GitHub token stored in the encrypted vault,
# then push the current branch to origin.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="$REPO_ROOT/.env.vault"
KEY="${AGE_KEY:-$HOME/.config/cortexx/age.key}"
TMP_ENV=$(mktemp)
TMP_TOKEN=$(mktemp)

cleanup() {
  shred -u "$TMP_ENV" "$TMP_TOKEN" 2>/dev/null || true
}
trap cleanup EXIT

if [ ! -f "$VAULT" ]; then
  echo "Error: encrypted vault not found at $VAULT" >&2
  exit 1
fi
if [ ! -f "$KEY" ]; then
  echo "Error: age identity not found at $KEY" >&2
  exit 1
fi

age -d -i "$KEY" -o "$TMP_ENV" "$VAULT"

# Extract token, strip surrounding quotes if present.
awk -F= '/^GITHUB_TOKEN=/{gsub(/^"|"$/, "", $2); print $2}' "$TMP_ENV" > "$TMP_TOKEN"
TOKEN=$(cat "$TMP_TOKEN")

if [ -z "$TOKEN" ]; then
  echo "Error: GITHUB_TOKEN not found in vault" >&2
  exit 1
fi

# Authenticate with gh (non-interactive).
echo "$TOKEN" | gh auth login --with-token --hostname github.com

# Ensure git uses HTTPS with gh credentials rather than prompting.
gh auth setup-git

# Push.
cd "$REPO_ROOT"
git push origin main
