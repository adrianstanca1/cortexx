---
name: s3-admin-blockers
description: Off-site S3 replication and admin.cortexbuildpro.com DNS are the only remaining blockers.
metadata: 
  node_type: memory
  type: project
  originSessionId: a13a7a18-cf08-4dc9-b374-4db0a8671352
  modified: 2026-07-27T23:27:10.964Z
---

All Phase 1/2 stabilization work is complete. Two operational items remain blocked by external inputs:

1. **S3 off-site replication is disabled** because `/root/.config/rclone/aws.env` contains empty `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Nightly local backups still run and Hermes falls back to Telegram; scripts skip S3 gracefully.

2. **`admin.cortexbuildpro.com` public DNS is missing**. The admin container is healthy and reachable via `https://admin.srv1262179.hstgr.cloud`. Add an A record pointing `admin.cortexbuildpro.com` to `72.62.132.43`.

**Why:** These cannot be fixed from the server itself; they require credentials only the user controls and a DNS change at the domain registrar.

**How to apply:** When the user supplies AWS keys, populate `/root/.config/rclone/aws.env` (mode 0600), then run `bash /etc/cron.daily/cortexx-backup` to verify S3 copy. When they want the branded admin URL, add the A record and confirm with `curl -I https://admin.cortexbuildpro.com`.

[[Phase 1 credential hardening]]
