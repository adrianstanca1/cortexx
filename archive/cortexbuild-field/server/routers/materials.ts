/**
 * Phase 3.2 — Materials delivery tracking.
 *
 * Schedule (office) → confirm/reject (site, offline-tolerant) workflow.
 * Tenant gating via companyScopedProcedure on every procedure. Role
 * gates via requireCompanyRole. Status transitions through assertTransition
 * from server/_core/material-delivery-state-machine.ts.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { companyScopedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { dbUnavailable } from '../_core/errors';
import { requireCompanyRole } from '../_core/role-check';
import {
  assertTransition,
  type MaterialDeliveryStatus,
} from '../_core/material-delivery-state-machine';
import { detectFieldConflicts } from '../_core/sync-conflict-detector';
import { sendPushToUsers } from '../_core/pushNotifications';
import { log } from '../_core/logger';
import {
  materialDeliveries,
  conflictPending,
  companyUsers,
  projects,
} from '../../drizzle/schema';

const STATUS = ['expected', 'delivered', 'rejected', 'cancelled'] as const;

export const materialsRouter = router({
  list: companyScopedProcedure
    .input(z.object({
      companyId: z.number(),
      projectId: z.number().optional(),
      status:    z.enum(STATUS).optional(),
      fromDate:  z.string().optional(),
      toDate:    z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(materialDeliveries.companyId, input.companyId)];
      if (input.projectId) conditions.push(eq(materialDeliveries.projectId, input.projectId));
      if (input.status)    conditions.push(eq(materialDeliveries.status, input.status));
      if (input.fromDate)  conditions.push(gte(materialDeliveries.expectedAt, new Date(input.fromDate)));
      if (input.toDate)    conditions.push(lte(materialDeliveries.expectedAt, new Date(input.toDate)));
      return db.select().from(materialDeliveries)
        .where(and(...conditions))
        .orderBy(asc(materialDeliveries.expectedAt));
    }),

  expectDelivery: companyScopedProcedure
    .input(z.object({
      companyId:           z.number(),
      projectId:           z.number(),
      supplierName:        z.string().min(1),
      materialDescription: z.string().min(1),
      expectedAt:          z.string(),
      notes:               z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireCompanyRole(ctx.companyMembership, 'manager');
      const db = await getDb();
      if (!db) throw dbUnavailable();

      // Cross-tenant FK guard — mirrors rfis.create. companyScopedProcedure
      // gates by company-membership but does not verify cross-references,
      // so a member of company A could otherwise schedule a delivery
      // against company B's project.
      const [project] = await db.select().from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.companyId, input.companyId)))
        .limit(1);
      if (!project) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });
      }

      const [row] = await db.insert(materialDeliveries).values({
        companyId:           input.companyId,
        projectId:           input.projectId,
        supplierName:        input.supplierName,
        materialDescription: input.materialDescription,
        expectedAt:          new Date(input.expectedAt),
        notes:               input.notes,
        status:              'expected',
        createdById:         ctx.user.id,
      }).returning();

      // Resolve recipients: every active member of this company at supervisor+.
      // v1 fan-out is company-wide for the role (no projectMembership table
      // exists yet — see spec § 7 / § 10).
      const RECIPIENT_ROLES = ['supervisor', 'manager', 'company_admin', 'super_admin'] as const;
      const memberships = await db.select().from(companyUsers).where(and(
        eq(companyUsers.companyId, input.companyId),
        eq(companyUsers.isActive, true),
      ));
      const recipientIds = memberships
        .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
        .map(m => m.userId);

      if (recipientIds.length > 0) {
        void sendPushToUsers(recipientIds, 'delivery_expected', {
          title: `Delivery expected: ${row.supplierName}`,
          body: `${project.name} — ${row.materialDescription}`,
          data: {
            deliveryId:   row.id,
            projectName:  project.name,
            supplierName: row.supplierName,
            expectedAt:   row.expectedAt.toISOString(),
            route:        'materials',
          },
        }).catch(err => log.error('[materials.expectDelivery] push failed:', err));
      }

      return row;
    }),

  /**
   * Site-side confirmation that a scheduled delivery has arrived.
   *
   * Sparse SET semantics: only fields explicitly present in `input` are
   * written. The offline replay path (queued from a worker's device that
   * has since been topped up with photos) must not clobber a previously
   * attached photo set just because the replayed payload omitted them.
   *
   * Status transition `expected → delivered` is enforced via the shared
   * state machine so `delivered → delivered` (idempotent retries from a
   * flapping connection) and other illegal moves surface BAD_REQUEST.
   *
   * Fans out a `delivery_received` push to office-side roles
   * (manager+) — site already knows the delivery arrived because they
   * just confirmed it.
   */
  markDelivered: companyScopedProcedure
    .input(z.object({
      companyId:        z.number(),
      id:               z.number(),
      deliveredAt:      z.string().optional(),
      notes:            z.string().optional(),
      gpsLat:           z.number().optional(),
      gpsLng:           z.number().optional(),
      photoStorageKeys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireCompanyRole(ctx.companyMembership, 'supervisor');
      const db = await getDb();
      if (!db) throw dbUnavailable();

      // Wrap read+assert+update in a transaction with `SELECT … FOR UPDATE`
      // (spec § 5.3 step 2). Without the row lock, two concurrent
      // markDelivered calls could both pass `assertTransition` against the
      // same `expected` row before either UPDATE lands — TOCTOU window.
      // Pattern mirrors rfis.update (server/routers/index.ts ~L2371).
      const { row, projectName } = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(materialDeliveries)
          .where(and(
            eq(materialDeliveries.id, input.id),
            eq(materialDeliveries.companyId, input.companyId),
          ))
          .limit(1)
          .for('update');
        if (!current) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
        }
        assertTransition(current.status as MaterialDeliveryStatus, 'delivered');

        // Project lookup inside the same tx — its `name` is needed for
        // the push payload (spec § 5.3 step 5). Done after `current` is
        // loaded so we have `current.projectId`.
        const [project] = await tx.select().from(projects)
          .where(eq(projects.id, current.projectId))
          .limit(1);

        // Sparse SET: only fields explicitly present in input are written,
        // so an offline replay that omits photos doesn't blank out a photo
        // set already attached by an earlier write. gps numerics are
        // written as strings — Drizzle's `decimal` round-trips as string
        // at runtime (see CLAUDE.md gotchas).
        const set: Record<string, unknown> = {
          status:       'delivered',
          deliveredAt:  input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
          receivedById: ctx.user.id,
          updatedAt:    new Date(),
        };
        if (input.notes            !== undefined) set.notes            = input.notes;
        if (input.gpsLat           !== undefined) set.gpsLat           = String(input.gpsLat);
        if (input.gpsLng           !== undefined) set.gpsLng           = String(input.gpsLng);
        if (input.photoStorageKeys !== undefined) set.photoStorageKeys = input.photoStorageKeys;

        const [updated] = await tx.update(materialDeliveries)
          .set(set)
          .where(and(
            eq(materialDeliveries.id, input.id),
            eq(materialDeliveries.companyId, input.companyId),
          ))
          .returning();

        return { row: updated, projectName: project?.name ?? '' };
      });

      // Push delivery_received → office (manager+). Site doesn't need
      // a notification since they're the ones who just confirmed it.
      // Fired AFTER the transaction commits — fire-and-forget shouldn't
      // be coupled to commit, and a push failure must not roll back the
      // delivery write.
      const RECIPIENT_ROLES = ['manager', 'company_admin', 'super_admin'] as const;
      const memberships = await db.select().from(companyUsers).where(and(
        eq(companyUsers.companyId, input.companyId),
        eq(companyUsers.isActive, true),
      ));
      const recipientIds = memberships
        .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
        .map(m => m.userId);

      if (recipientIds.length > 0) {
        void sendPushToUsers(recipientIds, 'delivery_received', {
          title: 'Delivery received',
          body: `${row.supplierName} arrived`,
          data: {
            deliveryId:   row.id,
            projectName,
            supplierName: row.supplierName,
            deliveredAt:  row.deliveredAt!.toISOString(),
            route:        'materials',
          },
        }).catch(err => log.error('[materials.markDelivered] push failed:', err));
      }

      return row;
    }),

  /**
   * Site-side rejection of a scheduled delivery (e.g. wrong product, wrong
   * quantity, damaged on arrival). Same shape as `markDelivered` but
   * `rejectionReason` is required so office-side can triage without
   * round-tripping back to site.
   *
   * Fires `delivery_rejected` — distinct event from `delivery_received` so
   * users can mute one without the other (spec § 9). Same recipient set
   * (manager+); site already knows it was rejected because they just
   * recorded the rejection.
   *
   * Mirrors `markDelivered`'s transaction shape: read+assert+update wrapped
   * with `.for('update')` to close the TOCTOU window between two concurrent
   * status writes; project lookup inside the same tx for the push payload's
   * `projectName`; push fires AFTER commit so a transient Expo failure
   * cannot roll back the rejection.
   */
  markRejected: companyScopedProcedure
    .input(z.object({
      companyId:        z.number(),
      id:               z.number(),
      rejectionReason:  z.string().min(1),
      deliveredAt:      z.string().optional(),
      notes:            z.string().optional(),
      gpsLat:           z.number().optional(),
      gpsLng:           z.number().optional(),
      photoStorageKeys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireCompanyRole(ctx.companyMembership, 'supervisor');
      const db = await getDb();
      if (!db) throw dbUnavailable();

      const { row, projectName } = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(materialDeliveries)
          .where(and(
            eq(materialDeliveries.id, input.id),
            eq(materialDeliveries.companyId, input.companyId),
          ))
          .limit(1)
          .for('update');
        if (!current) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
        }
        assertTransition(current.status as MaterialDeliveryStatus, 'rejected');

        const [project] = await tx.select().from(projects)
          .where(eq(projects.id, current.projectId))
          .limit(1);

        // Sparse SET — same offline-replay rationale as markDelivered.
        // `deliveredAt` is recorded even on rejection so the audit trail
        // captures when the truck actually showed up vs. the originally
        // expected slot.
        const set: Record<string, unknown> = {
          status:          'rejected',
          deliveredAt:     input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
          rejectionReason: input.rejectionReason,
          receivedById:    ctx.user.id,
          updatedAt:       new Date(),
        };
        if (input.notes            !== undefined) set.notes            = input.notes;
        if (input.gpsLat           !== undefined) set.gpsLat           = String(input.gpsLat);
        if (input.gpsLng           !== undefined) set.gpsLng           = String(input.gpsLng);
        if (input.photoStorageKeys !== undefined) set.photoStorageKeys = input.photoStorageKeys;

        const [updated] = await tx.update(materialDeliveries)
          .set(set)
          .where(and(
            eq(materialDeliveries.id, input.id),
            eq(materialDeliveries.companyId, input.companyId),
          ))
          .returning();

        return { row: updated, projectName: project?.name ?? '' };
      });

      const RECIPIENT_ROLES = ['manager', 'company_admin', 'super_admin'] as const;
      const memberships = await db.select().from(companyUsers).where(and(
        eq(companyUsers.companyId, input.companyId),
        eq(companyUsers.isActive, true),
      ));
      const recipientIds = memberships
        .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
        .map(m => m.userId);

      if (recipientIds.length > 0) {
        void sendPushToUsers(recipientIds, 'delivery_rejected', {
          title: 'Delivery rejected',
          body:  `${row.supplierName} — see reason`,
          data: {
            deliveryId:      row.id,
            projectName,
            supplierName:    row.supplierName,
            rejectionReason: row.rejectionReason,
            route:           'materials',
          },
        }).catch(err => log.error('[materials.markRejected] push failed:', err));
      }

      return row;
    }),

  /**
   * Office-side cancellation of a scheduled delivery (e.g. project paused,
   * order moved to a different supplier). Manager+ only — site cannot
   * cancel since site rejection is a different concept (truck arrived,
   * we refused it). No push fires: cancellation is internal book-keeping
   * before any field-level event has happened (spec § 5.5).
   *
   * Mirrors markDelivered/markRejected's transaction shape: read+assert+update
   * wrapped with `.for('update')` to close the TOCTOU window between two
   * concurrent status writes. cancellationReason is optional — admin may
   * want to record "supplier strike" but isn't required to.
   */
  /**
   * Free-form sparse edit. Two paths:
   *
   *   1. Online (no `baseSnapshot`) — only fields explicitly present in
   *      `input` are written, mirroring the markDelivered/markRejected
   *      sparse-SET rationale (offline replays must not blank out a column
   *      they didn't touch). If `status` is in the payload, the change is
   *      gated by `assertTransition` against the current row's status.
   *
   *   2. Offline-replay (`baseSnapshot` present) — the queue dispatcher
   *      hands us the values the row had when the form was opened. We
   *      open a transaction with `SELECT FOR UPDATE`, run
   *      `detectFieldConflicts`, then either:
   *        - apply cleanly (row missing fields the user touched? returns
   *          row_deleted),
   *        - park a `conflict_pending` row for in-app resolution
   *          (`conflict-fields-detected` registered in
   *          drizzle/conflict-registry.ts), or
   *        - apply (with assertTransition still enforced for status moves).
   *
   * No push fires — `update` is a free-form edit, not a state event. The
   * three state events are owned by markDelivered / markRejected /
   * cancelDelivery; emitting another push here would over-notify on
   * benign edits (e.g. correcting a typo in `notes`).
   *
   * Mirrors `rfis.update` (server/routers/index.ts ~L2344).
   */
  update: companyScopedProcedure
    .input(z.object({
      companyId:           z.number(),
      id:                  z.number(),
      supplierName:        z.string().min(1).optional(),
      materialDescription: z.string().min(1).optional(),
      expectedAt:          z.string().optional(),
      deliveredAt:         z.string().nullable().optional(),
      status:              z.enum(STATUS).optional(),
      notes:               z.string().nullable().optional(),
      gpsLat:              z.number().nullable().optional(),
      gpsLng:              z.number().nullable().optional(),
      rejectionReason:     z.string().nullable().optional(),
      cancellationReason:  z.string().nullable().optional(),
      // Optional offline-sync snapshot — set by the queue replay path
      // (lib/sync-queue.tsx). When present, the procedure runs the
      // field-level conflict detector against the row's current state
      // and either applies cleanly, parks a conflict_pending row, or
      // reports row_deleted. Online callers omit this and get the
      // sparse-SET behaviour.
      baseSnapshot: z.object({
        updatedAt:      z.string(),
        originalValues: z.record(z.string(), z.unknown()),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireCompanyRole(ctx.companyMembership, 'supervisor');
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const { companyId, id, baseSnapshot, ...rest } = input;

      // Build the user-payload sparsely: only fields explicitly present
      // in input go in. `id`/`companyId` already destructured out so
      // they cannot be remapped via the spread. Date and decimal columns
      // are normalised the same way as elsewhere in this router (decimal
      // → string per Drizzle's PG runtime, see CLAUDE.md gotchas).
      const userPayload: Record<string, unknown> = {};
      for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
        const v = rest[k];
        if (v === undefined) continue;
        if (k === 'expectedAt' || k === 'deliveredAt') {
          userPayload[k] = v === null ? null : new Date(v as string);
        } else if (k === 'gpsLat' || k === 'gpsLng') {
          userPayload[k] = v === null ? null : String(v);
        } else {
          userPayload[k] = v;
        }
      }

      if (baseSnapshot) {
        // Conflict-aware path. Pattern mirrors rfis.update — open a
        // transaction so SELECT FOR UPDATE + (optional) conflict_pending
        // insert + UPDATE all commit atomically.
        return await db.transaction(async (tx) => {
          const rows = await tx.select().from(materialDeliveries)
            .where(and(
              eq(materialDeliveries.id, id),
              eq(materialDeliveries.companyId, companyId),
            ))
            .limit(1)
            .for('update');
          const currentRow = rows[0] ?? null;

          const detection = detectFieldConflicts(
            currentRow,
            baseSnapshot.updatedAt,
            userPayload,
            baseSnapshot.originalValues,
          );

          if (detection.kind === 'row_deleted') {
            return { status: 'row_deleted' as const };
          }

          if (detection.kind === 'conflict') {
            const minePicked: Record<string, unknown> = {};
            for (const f of detection.fields) {
              if (f in userPayload) minePicked[f] = userPayload[f];
            }
            const [inserted] = await tx.insert(conflictPending).values({
              companyId,
              userId:         ctx.user.id,
              tableName:      'materials',
              rowId:          id,
              conflictFields: detection.fields,
              mineValues:     minePicked,
              theirsValues:   detection.theirsValues,
              baseUpdatedAt:  new Date(baseSnapshot.updatedAt),
            }).returning({ id: conflictPending.id });
            return {
              status:     'conflict' as const,
              conflictId: inserted.id,
              fields:     detection.fields,
            };
          }

          // ok — apply. assertTransition still gates status changes so
          // an offline replay can't bypass the state machine.
          if (userPayload.status !== undefined && currentRow) {
            assertTransition(
              currentRow.status as MaterialDeliveryStatus,
              userPayload.status as MaterialDeliveryStatus,
            );
          }
          const [row] = await tx.update(materialDeliveries)
            .set({ ...userPayload, updatedAt: new Date() })
            .where(and(
              eq(materialDeliveries.id, id),
              eq(materialDeliveries.companyId, companyId),
            ))
            .returning();
          return row;
        });
      }

      // Online path — no snapshot, no conflict detection. Still gate
      // status moves through assertTransition; sparse SET still applies.
      if (userPayload.status !== undefined) {
        const [current] = await db.select().from(materialDeliveries)
          .where(and(
            eq(materialDeliveries.id, id),
            eq(materialDeliveries.companyId, companyId),
          ))
          .limit(1);
        if (!current) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
        }
        assertTransition(
          current.status as MaterialDeliveryStatus,
          userPayload.status as MaterialDeliveryStatus,
        );
      }
      const [row] = await db.update(materialDeliveries)
        .set({ ...userPayload, updatedAt: new Date() })
        .where(and(
          eq(materialDeliveries.id, id),
          eq(materialDeliveries.companyId, companyId),
        ))
        .returning();
      return row;
    }),

  cancelDelivery: companyScopedProcedure
    .input(z.object({
      companyId:          z.number(),
      id:                 z.number(),
      cancellationReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireCompanyRole(ctx.companyMembership, 'manager');
      const db = await getDb();
      if (!db) throw dbUnavailable();

      const row = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(materialDeliveries)
          .where(and(
            eq(materialDeliveries.id, input.id),
            eq(materialDeliveries.companyId, input.companyId),
          ))
          .limit(1)
          .for('update');
        if (!current) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
        }
        assertTransition(current.status as MaterialDeliveryStatus, 'cancelled');

        const set: Record<string, unknown> = {
          status:    'cancelled',
          updatedAt: new Date(),
        };
        if (input.cancellationReason !== undefined) {
          set.cancellationReason = input.cancellationReason;
        }

        const [updated] = await tx.update(materialDeliveries)
          .set(set)
          .where(and(
            eq(materialDeliveries.id, input.id),
            eq(materialDeliveries.companyId, input.companyId),
          ))
          .returning();

        return updated;
      });

      // No push: cancellation is internal (spec § 5.5). Office initiated
      // the cancel and is the only audience that would care; site hasn't
      // engaged with the delivery yet.

      return row;
    }),
});
