# Cortex Construct — one user database for web and mobile

## Canonical production identity (verified 2026-10-08)

- Web: `https://cortexbuildpro.tech` (Auth.js credentials).
- Native iOS / Expo: `@adrianstanca/cortexx`, bundle `com.cortexbuild.app`; API base `https://cortexbuildpro.tech`.
- Both authentication routes query the **same** Prisma `User` and `UserOrganization` tables served by the same Next.js application.
- Production Next.js container `cortexbuild-construction-app-1` uses PostgreSQL at `db:5432/construction`, backed by the `construction_db` Docker volume. The web and mobile clients do **not** maintain independent account databases.
- Web uses an Auth.js session cookie; native uses a short-lived, signed Bearer token. The token carries the existing user's ID and their selected organization. Neither pathway copies or creates a second account on sign-in.
- User accounts and passwords belong to `User`. Workspace role and construction persona belong to `UserOrganization`, not a global cross-company role. `TeamMember` records are distinct staff profiles and should not be blindly synthesized from real owners.

## Production-safe seed

Default `npm run db:seed` and `npx prisma db seed` are dry-run, with **no database changes**. Use `npm run db:seed -- --apply` to create only missing NotificationPreference records. It never edits users, passwords, company memberships or project data.

**Internal smoke-test personas only:** `--apply --demo-roles` with `CORTEX_SEED_ORG_SLUG` set to an existing company and `CORTEX_SEED_CREDENTIAL_PATH` set to an owner-only absolute file **outside Git and the app build context**. This creates three low-privilege test accounts (PM, Foreman and Operative) with randomly generated passwords and reserved non-deliverable `@seed.invalid` emails. Each gets membership and TeamMember in the same existing organization. It never creates a new organization, project, or assigns privileged admin/owner roles. Do not use these accounts for real employees or send invitation/reset emails to their test addresses. For real staff, use tenant invitations and unique company-approved emails.

A second run with the same private credential file verifies that the accounts already exist and does **not** reset their passwords or roles. Role/policy changes require explicit administrative actions, not repeated seeds. The old project/invoice demo seeder is disabled unless an explicit development opt-in is present, and is forbidden under `NODE_ENV=production`.

## Verified production seed (2026-10-08)

Before: 4 actual users with passwords and memberships in 4 organizations, 3 missing notification preferences. Backup of four identity/staff tables saved only on the VPS at `/home/administrator/.cortex-construct-private/shared-users-preseed-20261008.dump` (0600). Seed filled 3 preference records and created 3 isolated demo roles inside the existing `cortexbuildpro` company, preserving the original 4 user records.

After: 7 users, 7 password hashes, 7 company memberships, 7 notification preferences, no orphaned users, no duplicate emails, 3 matching team profiles for the new demo accounts, and no test accounts with admin or owner membership. Demo access details are restricted to a private 0600 file on the VPS, and **must never be printed, committed or sent by email**.

## Release verification still required

- Authenticate a real employee through both web and iOS and compare the returned user and company IDs without exposing credentials in logs.
- Complete role-specific TestFlight checks, invitation acceptance, multi-company switching, password reset/TOTP, staff assignment and revocation.
- Keep demo personas restricted to internal tests; they currently have no project assignments, by design.
- Confirm that backups are restorable before considering any user-data migration or deletion.
