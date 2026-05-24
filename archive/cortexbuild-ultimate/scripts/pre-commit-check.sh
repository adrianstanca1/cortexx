#!/bin/bash
# Pre-commit validation script
set -e

echo "🔍 Pre-commit checks..."

echo "  1/4 Type checking..."
if ! npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo "     ✅ TypeScript OK"
else
  echo "     ❌ TypeScript errors found"
  npx tsc --noEmit 2>&1 | grep "error TS" | head -5
  exit 1
fi

echo "  2/4 Running tests..."
TEST_OUTPUT=$(npm test 2>&1)
if echo "$TEST_OUTPUT" | grep -qE "[0-9]+ passed"; then
  PASS_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ passed" | head -1); echo "     ✅ $PASS_COUNT"
else
  echo "     ❌ Test failures"
  echo "$TEST_OUTPUT" | grep "FAIL" | head -5
  exit 1
fi

echo "  3/4 Linting..."
LINT_OUTPUT=$(npm run lint 2>&1)
ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -c "error " || true)
if [ "$ERROR_COUNT" -eq 0 ]; then
  WARN_COUNT=$(echo "$LINT_OUTPUT" | grep -c "warning" || true)
  echo "     ✅ 0 errors, $WARN_COUNT warnings"
else
  echo "     ❌ $ERROR_COUNT lint errors"
  echo "$LINT_OUTPUT" | grep "error " | head -3
  exit 1
fi

echo "  4/4 Production build..."
if npm run build > /dev/null 2>&1; then
  echo "     ✅ Build OK"
else
  echo "     ❌ Build failed"
  exit 1
fi

echo "✅ All checks passed!"
