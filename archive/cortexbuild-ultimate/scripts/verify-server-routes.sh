#!/bin/bash
# Verify all server routes load without errors
echo "🔍 Checking server routes..."
ERRORS=0

for file in server/routes/*.js; do
  if node -c "$file" 2>/dev/null; then
    echo "  ✅ $(basename $file)"
  else
    echo "  ❌ $(basename $file)"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -eq 0 ]; then
  echo "✅ All $(ls server/routes/*.js | wc -l | tr -d ' ') route files valid"
else
  echo "❌ $ERRORS route files have syntax errors"
  exit 1
fi
