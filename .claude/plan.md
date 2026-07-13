# Implementation Plan — Edit capabilities, Training/Qualifications vertical, and codebase-wide CRUD uplift

## Goal

Deliver a concrete, high-quality first vertical for editing any data in Cortexx, using the user's example — **add/edit/delete qualifications, training, and courses for operatives and managers/supervisors** — while laying reusable foundations that make it cheap to add edit capability to every other page/feature.

## Current state (from sub-agent audit)

- **Certification model exists** in `prisma/schema.prisma` but it is the only skills-related table. It has an optional `memberId` link to `TeamMember`.
- **Backend endpoints:** `GET/POST /api/training`, `PUT/DELETE /api/training/[id]`. Missing `GET /api/training/[id]`, missing rate-limit on PUT, no RBAC gating, no org-scoped creation.
- **Team detail page** (`/team/[id]`) is read-only and does not include certifications.
- **Training registry page** (`/training`) can add/delete but has no edit mode, even though the PUT endpoint exists.
- **UI patterns:** modal-first editing, inline styles, `<Toast>`, `broadcastInvalidate`, no reusable form/modal primitives, no shared mutation hook.
- **Backend patterns:** every route hand-rolls auth, validation, rate limiting, error handling, audit/activity logging.

## Proposed scope

### Phase 1 — Reusable foundations (enables all future CRUD)

1. **Shared UI primitives** (no behaviour change, just DRY up existing patterns)
   - `components/ui/Modal.tsx` / `BottomSheet.tsx` — overlay, header, close, scroll-lock, Escape handling via `useModalEffects`.
   - `components/ui/FormField.tsx` — label + input/select/date/textarea with consistent styling and error text.
   - `components/ui/Button.tsx` — primary / secondary / danger / ghost variants with disabled/loading states.
   - `components/ui/SegmentedControl.tsx` — chip selector for status/priority/category.
2. **Shared client-side mutation hook**
   - `lib/useMutation.ts` — wraps `fetch`, `loading`, `error`, toast success/error, and `broadcastInvalidate(scope)`.
3. **Shared backend route wrapper**
   - `lib/withRoute.ts` — optional Zod schema, automatic `requireAuth`, optional rate limit, automatic `P2025` → 404 mapping, `reportError`, and structured 500 responses. Keeps the existing Prisma tenancy extension untouched.

### Phase 2 — Training / Qualifications / Courses vertical (the user's example)

1. **Schema additions**
   - Add `category` enum to `Certification` (`certification`, `qualification`, `training`, `course`).
   - Add a new `Course` catalog model (`id`, `title`, `provider?`, `defaultExpiryMonths?`, `createdAt`, `updatedAt`, `organizationId`).
   - Add optional `courseId` FK on `Certification` so a course catalog item can be linked to a completed record.
   - New migration file.
2. **Backend improvements**
   - Add `GET /api/training/[id]`.
   - Harden `PUT /api/training/[id]` with rate limiting, existence check / `P2025` → 404, and `memberId` validation.
   - Set `organizationId` on create/update via tenancy context.
   - Gate mutating routes with `canWrite` / `canManage` from `lib/rbac.ts`.
   - Add audit/activity logging on create/update/delete (mirror tasks/projects).
   - Update `GET /api/team` and `GET /api/team/[id]` to `include: { certifications: true }` so member cards can show skills.
3. **Frontend improvements**
   - Add an exported `Certification` type to `lib/types.ts`.
   - `/team/[id]`:
     - Add a "Qualifications & training" section listing current/expired/expiring items.
     - Add "Add qualification / training / course" button that opens a modal form.
     - Allow edit/delete of each item inline (modal or row actions).
   - `/training`:
     - Add edit mode to existing cards/forms.
     - Add category filter.
   - `/team` list:
     - Optionally show a small expiry alert pill if a member has expired/expiring certifications.

### Phase 3 — Broader edit-capability rollout (roadmap, not in this PR)

- Audit remaining read-only pages and apply the new primitives.
- Port the most duplicated pages (e.g., variations, milestones, materials) to the new `withRoute` + `useMutation` patterns.

## Approach & trade-offs

- **Modal-first editing** is already the established mobile-friendly pattern. We keep it and only centralize the shell.
- **Extend `Certification` rather than add 3 new tables** for this phase to minimise migration risk and deliver value quickly. A future phase can split into dedicated `Qualification`, `Course`, and `TrainingRecord` models if the domain grows.
- **No Tailwind rewrite** — new primitives will use the existing CSS variables and inline-style token colours so they blend with current pages.
- **Backend wrapper is additive** — existing routes keep working; new and refactored routes use `withRoute`.

## Team breakdown (sub-agents)

1. **Foundation lead** — creates `Modal`, `FormField`, `Button`, `SegmentedControl`, `useMutation`, and `withRoute`.
2. **Schema/backend lead** — schema changes, migrations, `/api/training/*` hardening, `/api/team` includes, audit/activity logging.
3. **Frontend lead** — `/team/[id]` qualifications section, `/training` edit mode, shared `Certification` type.
4. **QA/integration lead** — type-check, manual route smoke tests, review for consistency, update `CHANGELOG.md`.

## Deliverables

- Working add/edit/delete of qualifications, training, and courses for any team member.
- Presence of those records on `/team/[id]` and `/training`.
- Reusable components/hooks that the next CRUD feature can adopt in hours instead of days.
- Updated `CHANGELOG.md` entry.

## Risks

- `lib/db.ts` currently extends `tenancyExtension` then `broadcastExtension`. Adding another `$extends` is fine, but order matters: tenancy should remain first so the broadcast extension receives the already-scoped query results.
- Prisma schema changes require `npx prisma migrate dev` in a real environment; we will provide the migration file but cannot run it here because Node is unavailable.

## Request

Approve this plan so we can begin Phase 1 + Phase 2 implementation.
