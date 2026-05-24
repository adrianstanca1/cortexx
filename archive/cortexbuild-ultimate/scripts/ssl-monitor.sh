#!/usr/bin/env bash
# SSL Certificate Expiry Monitor
# Usage: ./scripts/ssl-monitor.sh [domain]
# Alerts when certs expire within 30 days

set -euo pipefail

DOMAIN="${1:-cortexbuildpro.com}"
WARN_DAYS=30
CRITICAL_DAYS=7

echo "🔒 SSL Certificate Monitor - $DOMAIN"
echo ""

# Check certificate expiry
EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

if [ -z "$EXPIRY" ]; then
  echo "❌ Cannot retrieve certificate for $DOMAIN"
  exit 1
fi

EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

echo "Domain: $DOMAIN"
echo "Expiry: $EXPIRY"
echo "Days remaining: $DAYS_LEFT"
echo ""

if [ "$DAYS_LEFT" -le "$CRITICAL_DAYS" ]; then
  echo "🚨 CRITICAL: Certificate expires in $DAYS_LEFT days! RENEW IMMEDIATELY!"
  exit 2
elif [ "$DAYS_LEFT" -le "$WARN_DAYS" ]; then
  echo "⚠️  WARNING: Certificate expires in $DAYS_LEFT days. Plan renewal."
  exit 1
else
  echo "✅ Certificate valid for $DAYS_LEFT more days"
  exit 0
fi
