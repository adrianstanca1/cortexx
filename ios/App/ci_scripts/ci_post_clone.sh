#!/bin/bash
# Xcode Cloud post-clone bootstrap.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
IOS_DIR="$REPO_ROOT/ios"
APP_DIR="$IOS_DIR/App"

echo "→ [ci_post_clone] repository: $REPO_ROOT"
echo "→ [ci_post_clone] iOS project: $IOS_DIR"

if [ ! -f "$IOS_DIR/package.json" ] || [ ! -f "$IOS_DIR/package-lock.json" ]; then
  echo "::error::iOS package manifest/lockfile not found under $IOS_DIR"
  exit 1
fi

# Xcode Cloud images can change their preinstalled CLI set. Resolve Homebrew
# from Apple Silicon or Intel locations before relying on npm/npx/CocoaPods.
if ! command -v brew >/dev/null 2>&1; then
  for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [ -x "$candidate" ]; then
      export PATH="$(dirname "$candidate"):$PATH"
      break
    fi
  done
fi

if ! command -v npm >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "  Node tooling not found — installing via Homebrew"
    brew install node
  else
    echo "::error::npm/npx are unavailable and Homebrew could not be found"
    exit 127
  fi
fi

# Capacitor sync may invoke CocoaPods internally. Make pod available BEFORE
# cap sync rather than trying to repair the environment after it has failed.
if ! command -v pod >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "  CocoaPods not found — installing via Homebrew"
    brew install cocoapods
  elif command -v gem >/dev/null 2>&1; then
    echo "  CocoaPods not found — installing into the Ruby user gem directory"
    gem install --user-install cocoapods --no-document
    export PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"
  else
    echo "::error::CocoaPods is unavailable and neither Homebrew nor RubyGems can install it"
    exit 127
  fi
fi

command -v npm >/dev/null 2>&1 || { echo "::error::npm bootstrap failed"; exit 127; }
command -v npx >/dev/null 2>&1 || { echo "::error::npx bootstrap failed"; exit 127; }
command -v pod >/dev/null 2>&1 || { echo "::error::CocoaPods bootstrap failed"; exit 127; }

# Install exactly the iOS-local JS graph and sync with its locked Capacitor 6.
cd "$IOS_DIR"
npm ci --no-audit --no-fund
npm run build:web
npx cap sync ios

# Ensure the committed workspace is synced with the Podfile lock after Capacitor.
cd "$APP_DIR"
if [ -f Gemfile ]; then
  command -v bundle >/dev/null 2>&1 || gem install --user-install bundler --no-document
  export PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"
  bundle install --local || bundle install
  bundle exec pod install --no-repo-update
else
  pod install --no-repo-update
fi

echo "→ [ci_post_clone] iOS dependencies and Capacitor assets are ready"
