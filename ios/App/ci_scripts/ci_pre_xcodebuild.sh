#!/bin/bash
# Xcode Cloud pre-build signing/version bootstrap.
# Apple supplies CI_TEAM_ID, CI_BUILD_NUMBER and CI_BUNDLE_ID for each build.
# Inject those values into the app target immediately before Xcode Cloud runs
# xcodebuild so archive signing never depends on a developer-machine setting.
set -euo pipefail

if [ "${CI_XCODE_CLOUD:-}" != "TRUE" ]; then
  echo "→ [ci_pre_xcodebuild] non-Xcode-Cloud build; no signing mutation required"
  exit 0
fi

: "${CI_PRIMARY_REPOSITORY_PATH:?CI_PRIMARY_REPOSITORY_PATH is required}"
: "${CI_TEAM_ID:?CI_TEAM_ID is required for Xcode Cloud signing}"
: "${CI_BUILD_NUMBER:?CI_BUILD_NUMBER is required for Xcode Cloud versioning}"
: "${CI_BUNDLE_ID:?CI_BUNDLE_ID is required for Xcode Cloud product identity}"

PROJECT_FILE="$CI_PRIMARY_REPOSITORY_PATH/ios/App/App.xcodeproj/project.pbxproj"
[ -f "$PROJECT_FILE" ] || { echo "::error::Missing Xcode project: $PROJECT_FILE"; exit 1; }

python3 - "$PROJECT_FILE" "$CI_TEAM_ID" "$CI_BUILD_NUMBER" "$CI_BUNDLE_ID" <<'PY'
from pathlib import Path
import re
import sys

project = Path(sys.argv[1])
team_id, build_number, bundle_id = sys.argv[2:5]
text = project.read_text()

# The App target has exactly two build configurations containing CODE_SIGN_STYLE.
# Insert or refresh Cloud-provided signing/version/product identity there only.
blocks = re.split(r'(\n\s*504EC31[78]1FED79650016851F /\* (?:Debug|Release) \*/ = \{)', text)
if len(blocks) < 5:
    raise SystemExit('App target build configurations were not found')

for i in range(2, len(blocks), 2):
    block = blocks[i]
    block = re.sub(r'\n\s*DEVELOPMENT_TEAM = [^;]*;', '', block)
    block = re.sub(r'CURRENT_PROJECT_VERSION = [^;]*;', f'CURRENT_PROJECT_VERSION = {build_number};', block)
    block = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = [^;]*;', f'PRODUCT_BUNDLE_IDENTIFIER = {bundle_id};', block)
    block = block.replace('CODE_SIGN_STYLE = Automatic;', f'CODE_SIGN_STYLE = Automatic;\n\t\t\t\tDEVELOPMENT_TEAM = {team_id};', 1)
    blocks[i] = block

project.write_text(''.join(blocks))
PY

echo "→ [ci_pre_xcodebuild] team=$CI_TEAM_ID bundle=$CI_BUNDLE_ID build=$CI_BUILD_NUMBER"
