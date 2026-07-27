#!/usr/bin/env bash
# CortexBuild Pro — VPS ops hardening installer.
#
# Run this ON the VPS (Hostinger hPanel → Browser terminal, or SSH):
#
#   curl -fsSL https://raw.githubusercontent.com/adrianstanca1/cortexx/main/ops/install-vps-ops.sh | bash
#
# Idempotent — safe to re-run. Makes three changes, each verified:
#
#   1. Installs the v2 nightly backup (real Docker DB + off-box S3 copy).
#      Previously the only off-site backup was of the EMPTY host Postgres.
#   2. chmod 600 on /etc/cron.d/cortexx-cron — it holds a CRON_SECRET bearer
#      token and was mode 644 (world-readable by any local user).
#   3. Reports on the Hermes backup pipeline, which still dumps the empty
#      host DB to S3. Disabling it is left to you (see the note it prints) —
#      those files belong to Hostinger's agent and it may rewrite them.

set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
RAW="https://raw.githubusercontent.com/adrianstanca1/cortexx/main"
fail=0

echo "══ 1. Nightly backup (real DB + off-box S3) ══"
if [ -f /etc/cron.daily/cortexx-backup ]; then
  cp /etc/cron.daily/cortexx-backup "/root/cortexx-backup.prev-$(date +%Y%m%d-%H%M%S)"
  echo "  backed up existing cron script to /root/"
fi
curl -fsSL "$RAW/ops/cortexx-backup-cron.sh" -o /etc/cron.daily/cortexx-backup
chmod +x /etc/cron.daily/cortexx-backup
# cron.daily ignores files with a dot in the name; ours has none. Verify anyway.
run-parts --test /etc/cron.daily | grep -q cortexx-backup \
  && echo "  ✓ installed and recognised by run-parts" \
  || { echo "  ✗ run-parts will NOT execute it — check filename"; fail=1; }

echo ""
echo "══ 2. Running it now (proves it works before tonight) ══"
if env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
     CORTEXX_S3_BUCKET="${CORTEXX_S3_BUCKET:-cortexx-db-backup}" \
     /bin/bash /etc/cron.daily/cortexx-backup; then
  echo "  ✓ backup succeeded"
else
  echo "  ✗ backup FAILED — see output above"
  fail=1
fi

echo ""
echo "══ 3. Off-box copy present in S3? ══"
if [ -f /root/.config/rclone/aws.env ] && command -v rclone >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  . /root/.config/rclone/aws.env
  BUCKET="${CORTEXX_S3_BUCKET:-cortexx-db-backup}"
  echo "  newest objects under cortexx-db/docker/:"
  rclone lsl "awss3:${BUCKET}/cortexx-db/docker/" 2>&1 | sort -k2 | tail -3 | sed 's/^/    /'
  if rclone lsl "awss3:${BUCKET}/cortexx-db/docker/" 2>/dev/null | grep -q .; then
    echo "  ✓ real database is now replicated off-box"
  else
    echo "  ✗ nothing in S3 — check rclone creds / bucket name"
    fail=1
  fi
else
  echo "  ✗ rclone or /root/.config/rclone/aws.env missing — NO off-box backup possible"
  fail=1
fi

echo ""
echo "══ 4. Secret file permissions ══"
if [ -f /etc/cron.d/cortexx-cron ]; then
  before=$(stat -c %a /etc/cron.d/cortexx-cron)
  chmod 600 /etc/cron.d/cortexx-cron
  echo "  /etc/cron.d/cortexx-cron: $before → $(stat -c %a /etc/cron.d/cortexx-cron) (holds CRON_SECRET)"
else
  echo "  (not present — skipped)"
fi

echo ""
echo "══ 5. Hermes pipeline status (informational) ══"
if [ -f /root/.hermes/scripts/cortexx_db_backup.sh ]; then
  cat <<'NOTE'
  The Hermes pipeline (/etc/cron.d/cortexx-backup, -replica, -replicate)
  still dumps the HOST Postgres — which has 83 tables and 0 rows — and
  uploads it to s3://<bucket>/cortexx-db/ nightly.

  It is now redundant and clutters S3 with empty dumps. To disable it:

    mv /etc/cron.d/cortexx-backup    /root/disabled-cortexx-backup.cron
    mv /etc/cron.d/cortexx-replicate /root/disabled-cortexx-replicate.cron
    mv /etc/cron.d/cortexx-replica   /root/disabled-cortexx-replica.cron

  Left in place deliberately: those files belong to Hostinger's Hermes
  agent, which may recreate them. Disable only if you're happy to
  re-check after agent updates.
NOTE
fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo "✅ All checks passed. Real database is backed up locally AND off-box."
else
  echo "⚠️  Finished with failures above — the off-box backup may not be working."
  exit 1
fi
