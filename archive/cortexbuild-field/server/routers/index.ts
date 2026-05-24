import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { systemRouter } from "../_core/systemRouter";
import { companyScopedProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  assertLoginAttemptsAllowed,
  clearLoginAttemptBucket,
  recordFailedLoginAttempt,
} from "../_core/login-rate-limit";
import { toCompanyRole } from "../_core/roles";
import { requireCompanyRole } from "../_core/role-check";
import { assertTransition, type RfiStatus } from "../_core/rfi-state-machine";
import { rfiAnsweredEmail, rfiApprovedEmail, rfiRejectedEmail, rfiSubmittedEmail } from "../_core/email-templates/rfi";
import { eq, desc, and, sql, isNull, or } from 'drizzle-orm';
import { getDb } from '../db';
import { dbUnavailable } from '../_core/errors';
import { notifyOwner } from '../_core/notification';
import { notify, recipientsByCompanyRole, recipientsByUserIds, safeRecipients } from '../_core/notifications';
import { sendPushToUserByName } from '../_core/pushNotifications';
import { invalidateCachedPrefs } from '../_core/push-prefs-cache';
import {
  fillDefaults,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from '../../shared/notification-events';
import { aiRouter } from "./ai";
import { filesRouter } from "./files";
import { authRouter } from './auth';
import { companiesRouter } from './companies';
import { documentsRouter } from './documents';
import { enquiriesRouter } from './enquiries';
import { financeRouter } from './finance';
import { conflictsRouter } from './conflicts';
import { materialsRouter } from './materials';
import { equipmentRouter } from './equipment';
import {
  projects as dbProjects,
  checkIns as dbCheckIns,
  defects as dbDefects,
  incidents as dbIncidents,
  pushTokens as dbPushTokens,
  timesheets as dbTimesheets,
  drawingPins as dbDrawingPins,
  invitedUsers as dbInvitedUsers,
  employeeCredentials as dbCredentials,
  companies as dbCompanies,
  teamMembers as dbTeamMembers,
  permits as dbPermits,
  dailyReports as dbDailyReports,
  tasks as dbTasks,
  inspections as dbInspections,
  rfis as dbRfis,
  observations as dbObservations,
  drawings as dbDrawings,
  announcements as dbAnnouncements,
  actionPlans as dbActionPlans,
  projectBookmarks as dbProjectBookmarks,
  companyUsers as dbCompanyUsers,
  companyApiKeys as dbCompanyApiKeys,
  companyFeatureFlags as dbCompanyFeatureFlags,
  users as dbUsers,
  conflictPending as dbConflictPending,
} from '../../drizzle/schema';
import { detectFieldConflicts } from '../_core/sync-conflict-detector';
import { log } from "../_core/logger";

/**
 * Procedures that the offline sync queue is allowed to replay.
 *
 * The mobile client buffers mutations to AsyncStorage when offline
 * (lib/sync-queue.tsx). When connectivity returns, it POSTs each item to
 * `sync.replay` with `{ type, payload }`. The replay dispatcher refuses
 * any type not in this set, so a misconfigured (or malicious) client
 * cannot use `sync.replay` as a back door to invoke arbitrary procedures.
 *
 * Add a procedure here only after:
 *   1. its inputs are idempotent enough to retry safely (replay can fire
 *      seconds, hours, or days after the original attempt), AND
 *   2. its inputs are JSON-serialisable as-typed (no Buffer / Date / etc.,
 *      since AsyncStorage round-trips through JSON.stringify/parse).
 */
const REPLAYABLE_TYPES: ReadonlySet<string> = new Set([
  // Field workers' offline-first writes — the original use case.
  'checkins.create',
  'checkins.checkout',
  'defects.create',
  'defects.updateStatus',
  'incidents.create',
  'dailyReports.create',
  'permits.create',
  'permits.updateStatus',
  'tasks.create',
  'tasks.updateStatus',
  'observations.create',
  'rfis.create',
  'rfis.update',
  'materials.markDelivered',
  'materials.markRejected',
  'materials.cancelDelivery',
  'materials.update',
  'bookmarks.add',
  'bookmarks.remove',
  'equipment.create',
  'equipment.update',
  'equipment.checkOut',
  'equipment.checkIn',
]);

async function ensureInviteMembership(
  db: Awaited<ReturnType<typeof getDb>>,
  input: {
    invite: typeof dbInvitedUsers.$inferSelect;
    fullName: string;
    phone?: string;
    trade?: string;
  },
) {
  if (!db) throw dbUnavailable();
  const email = input.invite.email.trim().toLowerCase();
  const existingUsers = await db.select().from(dbUsers).where(eq(dbUsers.email, email)).limit(1);
  const [user] = existingUsers.length
    ? await db.update(dbUsers)
        .set({ name: input.fullName, email, updatedAt: new Date() })
        .where(eq(dbUsers.id, existingUsers[0].id))
        .returning()
    : await db.insert(dbUsers).values({
        openId: `invite:${email}`,
        name: input.fullName,
        email,
        loginMethod: 'invitation',
        lastSignedIn: new Date(),
      }).returning();

  const companyRole = toCompanyRole(input.invite.role);
  const existingMembership = await db.select().from(dbCompanyUsers)
    .where(and(
      eq(dbCompanyUsers.companyId, input.invite.companyId),
      eq(dbCompanyUsers.userId, user.id),
    ))
    .limit(1);
  if (existingMembership.length) {
    await db.update(dbCompanyUsers)
      .set({
        companyRole,
        jobTitle: input.invite.role.replace(/_/g, ' '),
        department: input.invite.employeeClass,
        isActive: true,
      })
      .where(eq(dbCompanyUsers.id, existingMembership[0].id));
  } else {
    await db.insert(dbCompanyUsers).values({
      companyId: input.invite.companyId,
      userId: user.id,
      companyRole,
      jobTitle: input.invite.role.replace(/_/g, ' '),
      department: input.invite.employeeClass,
      isActive: true,
    });
  }

  const existingMember = await db.select().from(dbTeamMembers)
    .where(eq(dbTeamMembers.email, email))
    .limit(1);
  const projectId = input.invite.projectId ? Number(input.invite.projectId) : null;
  const teamValues = {
    name: input.fullName,
    role: input.invite.role,
    trade: input.trade ?? input.invite.employeeClass,
    email,
    phone: input.phone,
    projectId: Number.isFinite(projectId) ? projectId : null,
    status: 'active' as const,
  };
  if (existingMember.length) {
    await db.update(dbTeamMembers)
      .set(teamValues)
      .where(eq(dbTeamMembers.id, existingMember[0].id));
  } else {
    await db.insert(dbTeamMembers).values(teamValues);
  }

  return { user, companyRole };
}

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,

  sync: router({
    /**
     * Replay a mutation that the mobile client queued while offline.
     *
     * Routes the queued mutation to the actual procedure on the live router
     * (via `appRouter.createCaller(ctx)`), so all middlewares (auth +
     * companyScopedProcedure + zod input parsing) run identically to a
     * normal call. This is the only way an offline-queued mutation actually
     * reaches the database — without this dispatcher, the queue silently
     * drops user data on reconnect.
     *
     * Allow-list: only mutations explicitly designed to be replayed are
     * accepted. Anything else returns BAD_REQUEST so a misconfigured client
     * (or an attacker who learns about this endpoint) can't trigger
     * arbitrary internal procedures.
     *
     * Note: kept as `publicProcedure` because the replay loop runs at the
     * network-recovery boundary where the JWT may need refreshing. The
     * replayed procedure runs through its own auth middleware — a queued
     * `defects.create` will hit `companyScopedProcedure`, which requires
     * the caller's JWT to be valid. If the user's session expired, the
     * replay will return UNAUTHORIZED and the client can choose whether
     * to retry or hold the item.
     */
    replay: publicProcedure
      .input(z.object({
        type: z.string(),
        payload: z.unknown().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!REPLAYABLE_TYPES.has(input.type)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `sync.replay does not accept type "${input.type}". Add it to REPLAYABLE_TYPES if it should be queueable.`,
          });
        }

        const segments = input.type.split('.');
        // appRouter is hoisted into the closure: this handler runs at request
        // time, by which point the const has been initialised, so the
        // self-reference is safe even though it looks circular at first glance.
        const caller = appRouter.createCaller(ctx);
        let target: any = caller;
        for (const seg of segments) {
          target = target?.[seg];
        }
        if (typeof target !== 'function') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `sync.replay could not resolve "${input.type}" on the router.`,
          });
        }

        const result = await target(input.payload);
        return {
          success: true,
          type: input.type,
          replayedAt: new Date().toISOString(),
          result,
        };
      }),
  }),

  // ─── Offline-Sync Conflicts ──────────────────────────────────────────────

  conflicts: conflictsRouter,

  // ─── File Storage ─────────────────────────────────────────────────────────

  files: filesRouter,

  // ─── AI Features ─────────────────────────────────────────────────────────

  ai: aiRouter,

  // ─── Document Generation ──────────────────────────────────────────────────

  documents: documentsRouter,

  // ─── Live Database: Projects ──────────────────────────────────────────────

  projects: router({
    list: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(dbProjects)
          .where(eq(dbProjects.companyId, input.companyId))
          .orderBy(dbProjects.createdAt);
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        clientName: z.string().optional(),
        status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        budget: z.number().optional(),
        siteAddress: z.string().optional(),
        siteLat: z.number().optional(),
        siteLng: z.number().optional(),
        geofenceRadius: z.number().optional(),
        projectManager: z.string().optional(),
        contractType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const rows = await db.insert(dbProjects).values({
          companyId: input.companyId,
          name: input.name,
          description: input.description ?? null,
          clientName: input.clientName ?? null,
          status: input.status,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          budget: input.budget ? String(input.budget) : null,
          siteAddress: input.siteAddress ?? null,
          siteLat: input.siteLat ? String(input.siteLat) : null,
          siteLng: input.siteLng ? String(input.siteLng) : null,
          geofenceRadius: input.geofenceRadius ?? 200,
          projectManager: input.projectManager ?? null,
          contractType: input.contractType ?? null,
        }).returning();
        return rows[0];
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        progress: z.number().optional(),
        status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
        spent: z.number().optional(),
        // Postgres DECIMAL columns round-trip as strings in drizzle's pg dialect,
        // so accept the encoded string form here (already produced client-side).
        siteLat: z.string().optional(),
        siteLng: z.string().optional(),
        geofenceRadius: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const updates: Record<string, any> = {};
        if (input.progress !== undefined) updates.progress = input.progress;
        if (input.status !== undefined) updates.status = input.status;
        if (input.spent !== undefined) updates.spent = String(input.spent);
        if (input.siteLat !== undefined) updates.siteLat = input.siteLat;
        if (input.siteLng !== undefined) updates.siteLng = input.siteLng;
        if (input.geofenceRadius !== undefined) updates.geofenceRadius = input.geofenceRadius;
        if (Object.keys(updates).length > 0) {
          await db.update(dbProjects).set(updates)
            .where(and(eq(dbProjects.id, input.id), eq(dbProjects.companyId, input.companyId)));
        }
        return { success: true };
      }),
    /**
     * Delete a project. Tenant-safe via `companyId` in the WHERE.
     *
     * NOTE: child rows in defects / incidents / dailyReports / etc.
     * carry `projectId` but no FK CASCADE on most of them — those rows
     * become orphans pointing at a missing project. Listing screens
     * that join via projectsQuery.find(...) will fall back to
     * "Project #{id}" labels. A future schema migration could add
     * ON DELETE CASCADE; for now this matches the rest of the
     * delete procedures' behaviour.
     */
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbProjects)
          .where(and(eq(dbProjects.id, input.id), eq(dbProjects.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Check-Ins (HORUS) ────────────────────────────────────

  checkins: router({
    create: protectedProcedure
      .input(z.object({
        workerName: z.string(),
        projectId: z.number(),
        checkInLat: z.number().optional(),
        checkInLng: z.number().optional(),
        gpsVerified: z.boolean().optional(),
        distanceFromSite: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Tenancy gate: the project must belong to a company that the
        // caller is an active member of. check_ins has no companyId
        // column, so we derive it from the project and verify membership
        // here (`protectedProcedure` only confirms the caller is logged
        // in — it doesn't scope by company). Without this, any
        // authenticated user could check in to any project.
        if (ctx.user?.id !== undefined) {
          const [project] = await db.select({ companyId: dbProjects.companyId })
            .from(dbProjects)
            .where(eq(dbProjects.id, input.projectId))
            .limit(1);
          if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
          const [membership] = await db.select({ isActive: dbCompanyUsers.isActive })
            .from(dbCompanyUsers)
            .where(and(eq(dbCompanyUsers.userId, ctx.user.id), eq(dbCompanyUsers.companyId, project.companyId)))
            .limit(1);
          if (!membership || membership.isActive !== true) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this project.' });
          }
        }
        await db.insert(dbCheckIns).values({
          userId: ctx.user?.id ?? null,
          workerName: input.workerName,
          projectId: input.projectId,
          checkInLat: input.checkInLat !== undefined ? String(input.checkInLat) : null,
          checkInLng: input.checkInLng !== undefined ? String(input.checkInLng) : null,
          gpsVerified: input.gpsVerified ?? false,
          distanceFromSite: input.distanceFromSite ?? null,
        });
        return { success: true, checkedInAt: new Date().toISOString() };
      }),
    checkout: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        workerName: z.string(),
        checkOutLat: z.number().optional(),
        checkOutLng: z.number().optional(),
        durationMinutes: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Identify the open check-in by `userId = ctx.user.id` rather than
        // free-form workerName. Previously, any authenticated user could
        // check out anyone else's open check-in by guessing projectId +
        // workerName; now you can only close your own.
        if (ctx.user?.id === undefined) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const [latest] = await db.select().from(dbCheckIns)
          .where(and(
            eq(dbCheckIns.projectId, input.projectId),
            eq(dbCheckIns.userId, ctx.user.id),
            isNull(dbCheckIns.checkOutTime),
          ))
          .orderBy(desc(dbCheckIns.checkInTime))
          .limit(1);
        if (latest) {
          await db.update(dbCheckIns).set({
            checkOutTime: new Date(),
            checkOutLat: input.checkOutLat !== undefined ? String(input.checkOutLat) : null,
            checkOutLng: input.checkOutLng !== undefined ? String(input.checkOutLng) : null,
            durationMinutes: input.durationMinutes ?? null,
          }).where(eq(dbCheckIns.id, latest.id));
        }
        return { success: true, checkedOutAt: new Date().toISOString() };
      }),
    history: protectedProcedure
      .input(z.object({ projectId: z.number().optional(), limit: z.number().default(20) }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        // Scope to the caller's own check-ins (`userId = ctx.user.id`).
        // Previously this returned all check-ins across all tenants when
        // projectId was omitted, and any tenant's check-ins for a given
        // projectId. check_ins has no companyId column to scope by, so
        // user-scoping is the cleanest tightening that doesn't require
        // a schema migration.
        if (ctx.user?.id === undefined) return [];
        const conditions = [eq(dbCheckIns.userId, ctx.user.id)];
        if (input.projectId) conditions.push(eq(dbCheckIns.projectId, input.projectId));
        return db.select().from(dbCheckIns)
          .where(and(...conditions))
          .orderBy(desc(dbCheckIns.checkInTime))
          .limit(input.limit);
      }),
  }),

  // ─── Live Database: Defects ───────────────────────────────────────────────

  defects: router({
    list: companyScopedProcedure
      .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filter = input.projectId
          ? and(eq(dbDefects.companyId, input.companyId), eq(dbDefects.projectId, input.projectId))
          : eq(dbDefects.companyId, input.companyId);
        return db.select().from(dbDefects).where(filter).orderBy(desc(dbDefects.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        trade: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        assignedTo: z.string().optional(),
        reportedBy: z.string(),
        photoUrls: z.array(z.string()).optional(),
        aiAnalysis: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Verify the project belongs to the requested company. Without this,
        // a user with an active membership in company A could pass companyA
        // (passing the companyScopedProcedure check) but a projectId from
        // company B and create a defect against B's project.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        await db.insert(dbDefects).values({
          companyId: input.companyId,
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          trade: input.trade ?? null,
          priority: input.priority,
          reportedBy: input.reportedBy,
          assignedTo: input.assignedTo ?? null,
          photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
          aiAnalysis: input.aiAnalysis ?? null,
        });

        // Notify the assignee if one was set. Fire-and-forget: a missed
        // notification mustn't block the defect from being recorded.
        // sendPushToUserByName is a safe no-op when the assignee string
        // doesn't match any user (e.g. "Site team" placeholders).
        const assigneeForPush = input.assignedTo?.trim();
        if (assigneeForPush) {
          void (async () => {
            try {
              await sendPushToUserByName(assigneeForPush, 'defect_assigned', {
                title: `New ${input.priority} defect assigned`,
                body: input.title,
                data: { route: 'defects', priority: input.priority },
              });
            } catch (error) {
              log.warn('[Push] defects.create assignee notify failed:', error);
            }
          })();
        }

        return { success: true };
      }),
    /**
     * Edit a defect's editable metadata. Status changes go through the
     * separate `updateStatus` procedure so the resolved-transition push
     * notification logic stays focused.
     *
     * `companyId` and `projectId` are NOT editable — moving a defect
     * between companies/projects would orphan the photos and audit
     * trail. `reportedBy` and timestamps are also fixed.
     *
     * Same partial-write rule as announcements/drawings updates.
     */
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        trade: z.string().nullable().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assignedTo: z.string().nullable().optional(),
        photoUrls: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Read the row BEFORE the update — same pattern as updateStatus —
        // so we can detect a genuine reassignment (assignedTo changed
        // AND now points to someone) and fire a defect_assigned push
        // exactly once. Without this, reassignment silently never
        // notifies the new owner even though create does.
        const [previous] = await db.select().from(dbDefects)
          .where(and(eq(dbDefects.id, input.id), eq(dbDefects.companyId, input.companyId)))
          .limit(1);
        // No row means: wrong companyId (cross-tenant attempt), deleted
        // defect, or stale id from the client. Surface NOT_FOUND
        // explicitly rather than letting the UPDATE silently match
        // zero rows and report success.
        if (!previous) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Defect not found.' });
        }

        const { id: _id, companyId: _c, photoUrls, ...rest } = input;
        const updateSet: Record<string, unknown> = { ...rest };
        if (photoUrls !== undefined) {
          updateSet.photoUrls = JSON.stringify(photoUrls);
        }
        await db.update(dbDefects).set(updateSet)
          .where(and(eq(dbDefects.id, input.id), eq(dbDefects.companyId, input.companyId)));

        // Only push on a genuine identity change to a non-empty
        // assignee. Edits that touch other fields, or clear/idempotent
        // assignedTo, must not generate a push. Detached so a
        // notification failure cannot mask the successful update.
        const assigneeChanged =
          input.assignedTo !== undefined &&
          input.assignedTo !== previous.assignedTo;
        const newAssignee = input.assignedTo?.trim();
        if (assigneeChanged && newAssignee) {
          const effectivePriority = input.priority ?? previous.priority;
          void (async () => {
            try {
              await sendPushToUserByName(newAssignee, 'defect_assigned', {
                title: `Defect reassigned: ${effectivePriority}`,
                body: input.title ?? previous.title,
                data: { route: 'defects', priority: effectivePriority, defectId: previous.id },
              });
            } catch (error) {
              log.warn('[Push] defects.update reassignment notify failed:', error);
            }
          })();
        }
        return { success: true };
      }),
    /**
     * Hard-delete a defect. Tenant-safe via `companyId` in the WHERE.
     * Photos in `/storage/...` (or legacy `/manus-storage/...`) are left
     * in place (storage layer has no delete helper by design — see
     * drawings.delete).
     */
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbDefects)
          .where(and(eq(dbDefects.id, input.id), eq(dbDefects.companyId, input.companyId)));
        return { success: true };
      }),
    updateStatus: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        id: z.number(),
        status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'disputed']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();

        // Read the row BEFORE the update so we can (a) tell whether this
        // is the genuine resolved transition vs an idempotent re-tap, and
        // (b) recover the reportedBy / title for the notification without
        // a second SELECT. If the row doesn't exist or belongs to another
        // tenant, the update below is a no-op anyway.
        const [previous] = await db.select().from(dbDefects)
          .where(and(eq(dbDefects.id, input.id), eq(dbDefects.companyId, input.companyId)))
          .limit(1);

        // companyId in the WHERE so a manager from company A cannot update
        // a defect in company B even by guessing/colliding ids.
        await db.update(dbDefects)
          .set({ status: input.status })
          .where(and(eq(dbDefects.id, input.id), eq(dbDefects.companyId, input.companyId)));

        // Notify the reporter only on the GENUINE "→ resolved" transition.
        // The pre-update SELECT lets us compare previous.status to the new
        // value and skip the duplicate push when a user re-taps "resolved"
        // on an already-resolved defect (the UI doesn't disable the active
        // status button, so this happens). The push runs in a detached
        // async task with try/catch so nothing in the notification path
        // can bubble out and mask the successful update.
        if (
          input.status === 'resolved' &&
          previous &&
          previous.status !== 'resolved' &&
          previous.reportedBy
        ) {
          void (async () => {
            try {
              await sendPushToUserByName(previous.reportedBy, 'defect_resolved', {
                title: 'Defect resolved',
                body: previous.title,
                data: { route: 'defects', defectId: previous.id },
              });
            } catch (error) {
              log.warn('[Push] defects.updateStatus resolved notify failed:', error);
            }
          })();
        }

        return { success: true };
      }),
  }),

  // ─── Live Database: Incidents ─────────────────────────────────────────────

  incidents: router({
    list: companyScopedProcedure
      .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filter = input.projectId
          ? and(eq(dbIncidents.companyId, input.companyId), eq(dbIncidents.projectId, input.projectId))
          : eq(dbIncidents.companyId, input.companyId);
        return db.select().from(dbIncidents).where(filter).orderBy(desc(dbIncidents.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        type: z.enum(['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security']),
        severity: z.enum(['near_miss', 'low', 'medium', 'high', 'critical']),
        location: z.string().optional(),
        reportedBy: z.string(),
        photoUrls: z.array(z.string()).optional(),
        immediateAction: z.string().optional(),
        riddorRequired: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Same project↔company check as defects.create — a valid membership
        // for company A must not be enough to file an incident against
        // company B's project.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        await db.insert(dbIncidents).values({
          companyId: input.companyId,
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          severity: input.severity,
          location: input.location ?? null,
          reportedBy: input.reportedBy,
          immediateAction: input.immediateAction ?? null,
          photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
          riddorRequired: input.riddorRequired ?? false,
        });
        return { success: true };
      }),
    /**
     * Edit an incident's metadata. Same partial-write rule as the other
     * update procedures — only fields actually present in input are
     * written. companyId / projectId / reportedBy stay fixed (audit
     * trail). Status changes are out of scope here; if a status field
     * is added later it should get its own procedure with the relevant
     * push-notification logic.
     */
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        type: z.enum(['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security']).optional(),
        severity: z.enum(['near_miss', 'low', 'medium', 'high', 'critical']).optional(),
        location: z.string().nullable().optional(),
        immediateAction: z.string().nullable().optional(),
        photoUrls: z.array(z.string()).optional(),
        riddorRequired: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, photoUrls, ...rest } = input;
        const updateSet: Record<string, unknown> = { ...rest };
        if (photoUrls !== undefined) updateSet.photoUrls = JSON.stringify(photoUrls);
        await db.update(dbIncidents).set(updateSet)
          .where(and(eq(dbIncidents.id, input.id), eq(dbIncidents.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbIncidents)
          .where(and(eq(dbIncidents.id, input.id), eq(dbIncidents.companyId, input.companyId)));
        return { success: true };
      }),
  }),



  // ─── Live Database: Drawing Pins ──────────────────────────────────────────────

  drawingPins: router({
    list: companyScopedProcedure
      .input(z.object({
        drawingId: z.string(),
        companyId: z.number(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db.select().from(dbDrawingPins)
          .where(and(eq(dbDrawingPins.drawingId, input.drawingId), eq(dbDrawingPins.companyId, input.companyId)))
          .orderBy(dbDrawingPins.createdAt);
        return rows;
      }),
    add: companyScopedProcedure
      .input(z.object({
        companyId:     z.number(),
        drawingId:     z.string(),
        drawingNumber: z.string().optional(),
        pinType:       z.enum(['defect', 'rfi', 'note']),
        xPct:          z.number(),
        yPct:          z.number(),
        title:         z.string(),
        description:   z.string().optional(),
        assignedTo:    z.string().optional(),
        photoUrl:      z.string().optional(),
        createdBy:     z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const [drawing] = await db.select().from(dbDrawings)
          .where(and(eq(dbDrawings.id, Number(input.drawingId)), eq(dbDrawings.companyId, input.companyId)))
          .limit(1);
        if (!drawing) throw new Error('Drawing not found for this company.');
        const rows = await db.insert(dbDrawingPins).values({
          companyId:     input.companyId,
          drawingId:     input.drawingId,
          drawingNumber: input.drawingNumber ?? null,
          pinType:       input.pinType,
          xPct:          String(input.xPct),
          yPct:          String(input.yPct),
          title:         input.title,
          description:   input.description ?? null,
          assignedTo:    input.assignedTo ?? null,
          photoUrl:      input.photoUrl ?? null,
          createdBy:     input.createdBy ?? null,
        }).returning();
        return { success: true, id: rows[0]?.id ?? null, pin: rows[0] ?? null };
      }),
    updateStatus: companyScopedProcedure
      .input(z.object({
        id:        z.number(),
        companyId: z.number(),
        status:    z.enum(['open', 'in_progress', 'resolved']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbDrawingPins)
          .set({ status: input.status })
          .where(and(eq(dbDrawingPins.id, input.id), eq(dbDrawingPins.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbDrawingPins)
          .where(and(eq(dbDrawingPins.id, input.id), eq(dbDrawingPins.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Timesheets (Approval Workflow) ───────────────────────────

  timesheets: router({
    list: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        workerId:  z.number().optional(),
        status:    z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbTimesheets.companyId, input.companyId)];
        if (input.workerId) conditions.push(eq(dbTimesheets.workerId, input.workerId));
        if (input.status) conditions.push(eq(dbTimesheets.status, input.status));
        return db.select().from(dbTimesheets).where(and(...conditions)).orderBy(desc(dbTimesheets.createdAt));
      }),
    submit: companyScopedProcedure
      .input(z.object({
        companyId:      z.number(),
        workerId:       z.number().optional(),
        workerName:     z.string(),
        projectId:      z.number().optional(),
        projectName:    z.string().optional(),
        weekStarting:   z.string(),
        mondayHours:    z.number().default(0),
        tuesdayHours:   z.number().default(0),
        wednesdayHours: z.number().default(0),
        thursdayHours:  z.number().default(0),
        fridayHours:    z.number().default(0),
        saturdayHours:  z.number().default(0),
        sundayHours:    z.number().default(0),
        totalHours:     z.number().default(0),
        overtimeHours:  z.number().default(0),
        notes:          z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard: when projectId is provided, verify it
        // belongs to the requested company before INSERT. Otherwise a
        // member of company A could attach a timesheet to company B's
        // project. Only checks when projectId is provided — timesheets
        // submitted without a project (rare but valid) skip the check.
        // Mirrors the same conditional pattern in documents.saveGenerated
        // and files.upload.
        if (input.projectId !== undefined) {
          const [project] = await db.select().from(dbProjects)
            .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
            .limit(1);
          if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });
        }
        const computedTotalHours =
          input.mondayHours + input.tuesdayHours + input.wednesdayHours +
          input.thursdayHours + input.fridayHours + input.saturdayHours + input.sundayHours;
        const computedOvertimeHours = Math.max(0, computedTotalHours - 40);
        await db.insert(dbTimesheets).values({
          companyId:      input.companyId,
          workerId:       input.workerId ?? null,
          workerName:     input.workerName,
          projectId:      input.projectId ?? null,
          projectName:    input.projectName ?? null,
          weekStarting:   input.weekStarting,
          mondayHours:    String(input.mondayHours),
          tuesdayHours:   String(input.tuesdayHours),
          wednesdayHours: String(input.wednesdayHours),
          thursdayHours:  String(input.thursdayHours),
          fridayHours:    String(input.fridayHours),
          saturdayHours:  String(input.saturdayHours),
          sundayHours:    String(input.sundayHours),
          totalHours:     String(computedTotalHours),
          overtimeHours:  String(input.overtimeHours ?? computedOvertimeHours),
          status:         'submitted',
          submittedAt:    new Date(),
          notes:          input.notes ?? null,
        });
        return { success: true };
      }),
    approve: companyScopedProcedure
      .input(z.object({
        id:         z.number(),
        companyId:  z.number(),
        // reviewedBy is preserved for backward-compat with existing UI
        // callers but is intentionally IGNORED — see the override below.
        // Kept optional to ease rolling clients off it; once super-admin
        // and approvals screens stop sending it the field can be removed.
        reviewedBy: z.string().optional(),
        notes:      z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Approver attribution is ALWAYS the authenticated caller's
        // display name. Previously the procedure trusted
        // `input.reviewedBy`, which let any signed-in caller forge the
        // "approved by" audit trail (super-admin.tsx hard-coded
        // 'Super Admin' for every super-admin who clicked approve, and
        // approvals.tsx took whatever the client UI typed). For payroll
        // sign-off the actual approver matters — finance / HMRC audits
        // rely on this column.
        const approverName = ctx.user.name?.trim() || ctx.user.email?.trim() || `user-${ctx.user.id}`;
        await db.update(dbTimesheets)
          .set({ status: 'approved', approvedBy: approverName, approvedAt: new Date(), notes: input.notes ?? null })
          .where(and(eq(dbTimesheets.id, input.id), eq(dbTimesheets.companyId, input.companyId)));
        return { success: true, action: 'approved' };
      }),
    reject: companyScopedProcedure
      .input(z.object({
        id:         z.number(),
        companyId:  z.number(),
        // Same intentional ignore as approve — see the override below.
        reviewedBy: z.string().optional(),
        notes:      z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Same approver-attribution rule as `approve` above. The DB
        // column is named approvedBy regardless of action; rejection
        // metadata lives in `notes`.
        const approverName = ctx.user.name?.trim() || ctx.user.email?.trim() || `user-${ctx.user.id}`;
        await db.update(dbTimesheets)
          .set({ status: 'rejected', approvedBy: approverName, approvedAt: new Date(), notes: input.notes })
          .where(and(eq(dbTimesheets.id, input.id), eq(dbTimesheets.companyId, input.companyId)));
        return { success: true, action: 'rejected' };
      }),
  }),


  // ─── User Invitations ─────────────────────────────────────────────────────
  users: router({
    invite: companyScopedProcedure
      .input(z.object({
        companyId:     z.number(),
        email:         z.string().email(),
        name:          z.string().min(1),
        role:          z.string().default('field_worker'),
        employeeClass: z.string().default('Operative'),
        projectId:     z.string().optional(),
        projectName:   z.string().optional(),
        invitedBy:     z.string().default('Admin'),
        companyName:   z.string().default('CortexBuild Ltd'),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Generate a 6-digit numeric PIN
        const pin = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.insert(dbInvitedUsers).values({
          email:         input.email,
          name:          input.name,
          role:          input.role,
          employeeClass: input.employeeClass,
          companyId:     input.companyId,
          projectId:     input.projectId,
          projectName:   input.projectName,
          pin,
          invitedBy:     input.invitedBy,
          expiresAt,
        });

        // Build onboarding link (deep link into the app)
        const onboardingLink = `https://cortexbuild.app/onboard?email=${encodeURIComponent(input.email)}&pin=${pin}`;

        // Send notification to owner (acts as email relay)
        const emailBody = [
          `You have been invited to join ${input.companyName} on CortexBuild Field.`,
          ``,
          `Name: ${input.name}`,
          `Role: ${input.role.replace(/_/g, ' ')}`,
          `Employee Class: ${input.employeeClass}`,
          input.projectName ? `Project: ${input.projectName}` : '',
          ``,
          `Your temporary PIN: ${pin}`,
          `This PIN expires in 7 days.`,
          ``,
          `To accept your invitation, open the CortexBuild Field app and enter:`,
          `  Email: ${input.email}`,
          `  PIN:   ${pin}`,
          ``,
          `Or tap this link: ${onboardingLink}`,
          ``,
          `Invited by: ${input.invitedBy}`,
        ].filter(l => l !== null).join('\n');

        // Primary delivery channel: email PIN to the invitee via Brevo.
        // P1-A/F: PIN must NEVER round-trip through the tRPC response body.
        // If this throws, the admin sees the error and can use resendInvite
        // to retry (which rotates the PIN and tries to send again).
        // The gateway catches sendEmail errors internally; we re-throw
        // the captured cause from result.errors[0] to preserve the legacy
        // throw-on-failure contract that admin-facing tests pin via
        // `.rejects.toThrow(/Brevo/i)`.
        const inviteResult = await notify({
          to: [{ userId: 0, email: input.email, name: input.name }],
          channels: {
            email: {
              template: () => ({
                to: input.email,
                subject: `[CortexBuild] Invitation from ${input.companyName}`,
                text: emailBody,
              }),
            },
          },
          context: "users.invite",
          mode: "awaited",
        });
        if (inviteResult.mode === "awaited" && inviteResult.failed > 0) {
          throw inviteResult.errors[0];
        }

        // Owner notification (best-effort) — the original email-relay path
        // for ops visibility. Failure here does not roll back the invite.
        await notifyOwner({
          title: `[CortexBuild] Invitation for ${input.name} <${input.email}>`,
          content: emailBody,
        }).catch(error => {
          log.error('[users.invite] notifyOwner failed:', error);
        });

        // P1-A: response intentionally omits `pin` and `onboardingLink`. The
        // PIN is only deliverable via the email channel above.
        return {
          success: true,
          expiresAt: expiresAt.toISOString(),
          message: `Invitation sent to ${input.email}.`,
        };
      }),

    // acceptInvite must be callable without auth — it's the bootstrap for a
    // brand-new user who only has an email + PIN. The handler validates the
    // PIN itself, so the unauth surface is intentional and bounded.
    acceptInvite: publicProcedure
      .input(z.object({
        email:       z.string().email(),
        pin:         z.string().length(6),
        firstName:   z.string().min(1),
        lastName:    z.string().min(1),
        phone:       z.string().optional(),
        trade:       z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Rate-limit gate (P2-B): cap (ip, email) at LOGIN_RATE_LIMIT.limit
        // failures per LOGIN_RATE_LIMIT.windowMs. Without this, the 6-digit
        // PIN (only 900,000 values) is brute-forceable in under an hour.
        assertLoginAttemptsAllowed(ctx.req, input.email);

        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Find the pending invite directly in SQL to avoid loading historical invites.
        const [invite] = await db.select().from(dbInvitedUsers)
          .where(and(
            eq(dbInvitedUsers.email, input.email),
            eq(dbInvitedUsers.pin, input.pin),
            eq(dbInvitedUsers.status, 'pending'),
          ))
          .limit(1);
        if (!invite) {
          recordFailedLoginAttempt(ctx.req, input.email);
          throw new Error('Invalid email or PIN. Please check your invitation details.');
        }
        // Check expiry
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
          recordFailedLoginAttempt(ctx.req, input.email);
          throw new Error('This invitation has expired. Please ask your admin to send a new invite.');
        }
        // Mark invite as accepted
        await db.update(dbInvitedUsers)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eq(dbInvitedUsers.id, invite.id));
        // Successful accept clears the failure streak so a typo on first try
        // doesn't keep the user locked out.
        clearLoginAttemptBucket(ctx.req, input.email);
        const fullName = `${input.firstName} ${input.lastName}`;
        const membership = await ensureInviteMembership(db, {
          invite,
          fullName,
          phone: input.phone,
          trade: input.trade,
        });
        const sessionToken = await sdk.createSessionToken(membership.user.openId, {
          name: membership.user.name ?? fullName,
          expiresInMs: ONE_YEAR_MS,
        });
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: ONE_YEAR_MS,
        });
        const user = {
          id: membership.user.id,
          openId: membership.user.openId,
          name: membership.user.name,
          email: membership.user.email,
          loginMethod: membership.user.loginMethod,
          lastSignedIn: (membership.user.lastSignedIn ?? new Date()).toISOString(),
          role: membership.user.role,
          companyId: invite.companyId,
          companyRole: membership.companyRole,
          jobTitle: invite.role.replace(/_/g, ' '),
          department: invite.employeeClass,
        };
        return {
          success: true,
          companyId: invite.companyId,
          userId: membership.user.id,
          companyRole: membership.companyRole,
          sessionToken,
          user,
          name: fullName,
          role: invite.role,
          employeeClass: invite.employeeClass,
          projectName: invite.projectName,
          message: `Welcome to CortexBuild Field, ${input.firstName}! Your account is now active.`,
        };
      }),
    listInvites: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(dbInvitedUsers)
          .where(eq(dbInvitedUsers.companyId, input.companyId))
          .orderBy(dbInvitedUsers.createdAt);
      }),

    revokeInvite: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        // Audit log is now written by the companyScopedProcedure middleware
        // on every mutation — no per-procedure plumbing needed.
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbInvitedUsers)
          .set({ status: 'expired' })
          .where(and(eq(dbInvitedUsers.id, input.id), eq(dbInvitedUsers.companyId, input.companyId)));
        return { success: true };
      }),
    resendInvite: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        companyName: z.string().default('CortexBuild Ltd'),
        invitedBy: z.string().default('Admin'),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Find the most recent reusable invite for this email.
        const [invite] = await db.select().from(dbInvitedUsers)
          .where(and(
            eq(dbInvitedUsers.email, input.email),
            or(eq(dbInvitedUsers.status, 'pending'), eq(dbInvitedUsers.status, 'expired')),
          ))
          .orderBy(desc(dbInvitedUsers.createdAt))
          .limit(1);
        if (!invite) throw new Error('No invitation found for this email address.');
        // Generate a fresh PIN and extend expiry by 7 days
        const newPin = String(Math.floor(100000 + Math.random() * 900000));
        const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.update(dbInvitedUsers)
          .set({ pin: newPin, expiresAt: newExpiry, status: 'pending' })
          .where(eq(dbInvitedUsers.id, invite.id));
        // Re-send notification
        const onboardingLink = `https://cortexbuild.app/onboard?email=${encodeURIComponent(input.email)}&pin=${newPin}`;
        const emailBody = [
          `Your CortexBuild Field invitation PIN has been reset.`,
          ``,
          `Email: ${input.email}`,
          `New PIN: ${newPin}`,
          `Expires: ${newExpiry.toLocaleDateString()}`,
          ``,
          `To accept your invitation, open the CortexBuild Field app and enter your email and PIN.`,
          `Or tap: ${onboardingLink}`,
          ``,
          `Sent by: ${input.invitedBy}`,
        ].join('\n');
        // Primary delivery: email the new PIN to the invitee. Throws on
        // Brevo failure; admin can call resendInvite again to retry.
        // Same pattern as users.invite: gateway catches internally,
        // we re-throw `result.errors[0]` to preserve the legacy
        // throw-on-failure contract pinned by admin-facing tests.
        const resendResult = await notify({
          to: [{ userId: 0, email: input.email, name: "" }],
          channels: {
            email: {
              template: () => ({
                to: input.email,
                subject: `[CortexBuild] PIN reset for your invitation`,
                text: emailBody,
              }),
            },
          },
          context: "users.resendInvite",
          mode: "awaited",
        });
        if (resendResult.mode === "awaited" && resendResult.failed > 0) {
          throw resendResult.errors[0];
        }

        // Owner relay (best-effort) — for ops visibility.
        await notifyOwner({
          title: `[CortexBuild] PIN Reset for <${input.email}>`,
          content: emailBody,
        }).catch(error => {
          log.error('[users.resendInvite] notifyOwner failed:', error);
        });

        // P1-F: response omits `pin`. PIN is delivered via email only.
        return {
          success: true,
          expiresAt: newExpiry.toISOString(),
          message: `A new PIN has been sent to ${input.email}.`,
        };
      }),
  }),

  // ─── Employee Credentials ─────────────────────────────────────────────────
  credentials: router({
    list: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(dbCredentials)
          .where(eq(dbCredentials.companyId, input.companyId))
          .orderBy(dbCredentials.employeeName);
      }),

    add: companyScopedProcedure
      .input(z.object({
        employeeId:   z.string(),
        employeeName: z.string(),
        credType:     z.string(),
        credNumber:   z.string().optional(),
        issueDate:    z.string().optional(),
        expiryDate:   z.string().optional(),
        notes:        z.string().optional(),
        companyId:    z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const rows = await db.insert(dbCredentials).values({
          companyId:    input.companyId,
          employeeId:   input.employeeId,
          employeeName: input.employeeName,
          credType:     input.credType,
          credNumber:   input.credNumber,
          issueDate:    input.issueDate,
          expiryDate:   input.expiryDate,
          notes:        input.notes,
        }).returning();
        return { success: true, id: rows[0]?.id ?? null, credential: rows[0] ?? null };
      }),

    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Filter by both id AND companyId — defence in depth on top of the
        // membership check enforced by companyScopedProcedure.
        await db.delete(dbCredentials).where(and(eq(dbCredentials.id, input.id), eq(dbCredentials.companyId, input.companyId)));
        return { success: true };
      }),

    checkExpiry: companyScopedProcedure
      .input(z.object({ companyId: z.number(), daysAhead: z.number().default(30) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { expiring: [], expired: [] };
        const all = await db.select().from(dbCredentials)
          .where(eq(dbCredentials.companyId, input.companyId));
        const now = new Date();
        const cutoff = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);
        const expiring: typeof all = [];
        const expired: typeof all = [];
        for (const c of all) {
          if (!c.expiryDate) continue;
          const expDate = new Date(c.expiryDate);
          if (expDate < now) expired.push(c);
          else if (expDate <= cutoff) expiring.push(c);
        }
        return { expiring, expired };
      }),

    renew: companyScopedProcedure
      .input(z.object({
        id:          z.number(),
        companyId:   z.number(),
        credNumber:  z.string().optional(),
        issueDate:   z.string().optional(),
        expiryDate:  z.string(),
        notes:       z.string().optional(),
        documentUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbCredentials)
          .set({
            credNumber:  input.credNumber,
            issueDate:   input.issueDate,
            expiryDate:  input.expiryDate,
            notes:       input.notes,
            alertSent:   0, // reset so next expiry cycle re-alerts
          })
          .where(and(eq(dbCredentials.id, input.id), eq(dbCredentials.companyId, input.companyId)));
        return { success: true };
      }),
    sendExpiryAlerts: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { alertsSent: 0 };
        const all = await db.select().from(dbCredentials)
          .where(eq(dbCredentials.companyId, input.companyId));
        const now = new Date();
        const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        let alertsSent = 0;
        for (const c of all) {
          if (!c.expiryDate || c.alertSent) continue;
          const expDate = new Date(c.expiryDate);
          const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (expDate <= cutoff) {
            const isExpired = expDate < now;
            const title = isExpired
              ? `[EXPIRED] ${c.employeeName} — ${c.credType}`
              : `[Expiring in ${daysLeft}d] ${c.employeeName} — ${c.credType}`;
            const content = [
              `Employee: ${c.employeeName}`,
              `Credential: ${c.credType}`,
              c.credNumber ? `Number: ${c.credNumber}` : null,
              `Expiry Date: ${c.expiryDate}`,
              isExpired ? `Status: EXPIRED` : `Status: Expires in ${daysLeft} days`,
              `Action Required: Renew credential and update records in CortexBuild Field.`,
            ]
              .filter((part): part is string => part !== null)
              .join('\n');
            // Only mark alertSent if the notification actually went out — otherwise
            // the next day's job won't retry and the alert is silently lost.
            // notifyOwner returns false (or throws) when the upstream service fails.
            let delivered = false;
            try {
              delivered = await notifyOwner({ title, content });
            } catch (error) {
              log.error('[sendExpiryAlerts] notifyOwner threw:', error);
            }
            if (delivered) {
              await db.update(dbCredentials).set({ alertSent: 1 }).where(eq(dbCredentials.id, c.id));
              alertsSent++;
            }
          }
        }
        return { alertsSent };
      }),
  }),

  // ─── Company Settings ────────────────────────────────────────────────────
  settings: router({
    get: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db.select().from(dbCompanies).where(eq(dbCompanies.id, input.companyId));
        return rows[0] ?? null;
      }),
    update: companyScopedProcedure
      .input(z.object({
        companyId:    z.number(),
        payrollEmail: z.string().email().optional(),
        name:         z.string().optional(),
        phone:        z.string().optional(),
        email:        z.string().optional(),
        address:      z.string().optional(),
        website:      z.string().optional(),
        utr:          z.string().optional(),
        cisStatus:    z.string().optional(),
        vatNumber:    z.string().optional(),
        companyNumber: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { companyId, ...fields } = input;
        // Filter out undefined values
        const updateFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) updateFields[k] = v;
        }
        if (Object.keys(updateFields).length === 0) return { success: true };
        await db.update(dbCompanies).set(updateFields).where(eq(dbCompanies.id, companyId));
        return { success: true };
      }),
    listApiKeys: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(dbCompanyApiKeys)
          .where(eq(dbCompanyApiKeys.companyId, input.companyId))
          .orderBy(desc(dbCompanyApiKeys.createdAt));
      }),
    saveApiKey: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        provider: z.string(),
        keyName: z.string(),
        rawKey: z.string().optional(),
        model: z.string().optional(),
        isDefault: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const maskedKey = input.rawKey
          ? `${input.rawKey.slice(0, 6)}...${input.rawKey.slice(-4)}`
          : 'built-in';
        if (input.isDefault) {
          await db.update(dbCompanyApiKeys)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(dbCompanyApiKeys.companyId, input.companyId));
        }
        const rows = await db.insert(dbCompanyApiKeys).values({
          companyId: input.companyId,
          provider: input.provider,
          keyName: input.keyName,
          maskedKey,
          encryptedKey: input.rawKey ? Buffer.from(input.rawKey).toString('base64') : 'built-in',
          model: input.model ?? 'default',
          isActive: true,
          isDefault: input.isDefault,
        }).returning();
        return rows[0];
      }),
    updateApiKey: companyScopedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        if (input.isDefault) {
          await db.update(dbCompanyApiKeys)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(dbCompanyApiKeys.companyId, input.companyId));
        }
        await db.update(dbCompanyApiKeys)
          .set({
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
            updatedAt: new Date(),
          })
          .where(eq(dbCompanyApiKeys.id, input.id));
        return { success: true };
      }),
    deleteApiKey: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // companyId in the WHERE so a key owned by another tenant can't
        // be deleted by guessing/colliding ids.
        await db.delete(dbCompanyApiKeys)
          .where(and(eq(dbCompanyApiKeys.id, input.id), eq(dbCompanyApiKeys.companyId, input.companyId)));
        return { success: true };
      }),
    listFeatureFlags: companyScopedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(dbCompanyFeatureFlags)
          .where(eq(dbCompanyFeatureFlags.companyId, input.companyId));
      }),
    setFeatureFlag: companyScopedProcedure
      .input(z.object({ companyId: z.number(), feature: z.string(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const existing = await db.select().from(dbCompanyFeatureFlags)
          .where(and(eq(dbCompanyFeatureFlags.companyId, input.companyId), eq(dbCompanyFeatureFlags.feature, input.feature)))
          .limit(1);
        if (existing[0]) {
          await db.update(dbCompanyFeatureFlags)
            .set({ enabled: input.enabled, updatedAt: new Date() })
            .where(eq(dbCompanyFeatureFlags.id, existing[0].id));
          return { success: true };
        }
        await db.insert(dbCompanyFeatureFlags).values({
          companyId: input.companyId,
          feature: input.feature,
          enabled: input.enabled,
        });
        return { success: true };
      }),
  }),
  // ─── Live Database: Push Tokens ───────────────────────────────────────────

  pushTokens: router({
    /**
     * Register an Expo push token for the authenticated user.
     *
     * Owner is always derived from `ctx.user.id` — accepting userId from the
     * client would let any logged-in user claim someone else's device token
     * (because this is `protectedProcedure`, not `companyScopedProcedure`,
     * and there's no companyId on push_tokens to scope by).
     *
     * `token` has a UNIQUE constraint at the schema level (migration
     * 0006_push_tokens_token_unique). The INSERT…ON CONFLICT DO UPDATE
     * below is a single atomic statement, so two concurrent registrations
     * of the same token can't both win — Postgres serialises them through
     * the unique-index lock. That gives us:
     *   - same user, repeated registrations (every cold start) — single
     *     row per device, no fan-out duplicates.
     *   - account-switch on shared device — user B's register flips the
     *     existing row to userId=B, so notifications destined for A no
     *     longer arrive on this device.
     *   - no race window between delete and insert.
     */
    register: protectedProcedure
      .input(z.object({
        token: z.string(),
        platform: z.enum(['ios', 'android', 'web']),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Wrap to translate raw drizzle/Postgres errors (FK violations
        // from a deleted users row, schema-drift on the platform enum,
        // pool exhaustion under load) into a typed TRPCError. Without
        // this the client receives a generic INTERNAL_SERVER_ERROR
        // with the raw Postgres error text — leaks driver internals,
        // and Sentry/ops can't distinguish a transient pool issue
        // from a real bug.
        try {
          await db.insert(dbPushTokens)
            .values({
              userId: ctx.user.id,
              token: input.token,
              platform: input.platform,
            })
            .onConflictDoUpdate({
              target: dbPushTokens.token,
              set: {
                userId: ctx.user.id,
                platform: input.platform,
                updatedAt: new Date(),
              },
            });
        } catch (error) {
          log.warn('[Push] pushTokens.register failed:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not register push token. Please try again.',
          });
        }
        return { success: true };
      }),

    /**
     * Read the authenticated user's push preferences with defaults
     * filled in for every known event type. The Settings UI uses this
     * to render a complete switch list without needing the registry
     * client-side (although the client imports the registry anyway for
     * labels). Convention codified in shared/notification-events.ts.
     */
    preferences: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        // Symmetric with updatePreference: prefer an honest error over
        // silent fallback to defaults. Loading "all on" then erroring
        // on first toggle is more confusing than refusing to load.
        if (!db) throw dbUnavailable();
        const rows = await db.select({ pushPreferences: dbUsers.pushPreferences })
          .from(dbUsers)
          .where(eq(dbUsers.id, ctx.user.id))
          .limit(1);
        return fillDefaults(rows[0]?.pushPreferences ?? {});
      }),

    /**
     * Update a single per-event preference for the authenticated user.
     *
     * Sparse storage is asymmetric on purpose: only the muted state is
     * persisted (jsonb_set writing 'false'). Re-enabling deletes the
     * key via the JSONB `-` operator rather than writing `true`, so
     * fresh users and re-enabled users are indistinguishable on the
     * read path — both look like {}. That keeps the column
     * self-cleaning and lets a future global-default flip reach sparse
     * rows without a backfill.
     */
    updatePreference: protectedProcedure
      .input(z.object({
        eventType: z.enum(NOTIFICATION_EVENT_TYPES as [NotificationEventType, ...NotificationEventType[]]),
        enabled: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // RETURNING id lets us detect a 0-row UPDATE (user deleted
        // between auth and mutation, schema drift). Without it the
        // mutation reports success but the toggle silently doesn't
        // persist — the user retries forever with no signal.
        const updated = (input.enabled
          ? await db.execute(sql`
              UPDATE users
              SET "pushPreferences" = "pushPreferences" - ${input.eventType}
              WHERE id = ${ctx.user.id}
              RETURNING id
            `)
          : await db.execute(sql`
              UPDATE users
              SET "pushPreferences" = jsonb_set(
                "pushPreferences",
                ${`{${input.eventType}}`},
                'false'::jsonb,
                true
              )
              WHERE id = ${ctx.user.id}
              RETURNING id
            `)) as unknown as { id: number }[];
        if (updated.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        }
        // Invalidate the last-known-prefs cache so the next gate read
        // sees the change immediately — without this, a user toggling
        // on one device could still receive a muted event on another
        // for up to TTL while the cache held the prior value.
        // Best-effort; failure here doesn't fail the mutation.
        void invalidateCachedPrefs(ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Live Database: Team Members ─────────────────────────────────────────
  teams: router({
    list: companyScopedProcedure
      .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [
          eq(dbTeamMembers.companyId, input.companyId),
          eq(dbTeamMembers.status, 'active'),
        ];
        if (input.projectId) conditions.push(eq(dbTeamMembers.projectId, input.projectId));
        return db.select().from(dbTeamMembers).where(and(...conditions)).orderBy(dbTeamMembers.name);
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        name: z.string(), role: z.string(), trade: z.string().optional(),
        email: z.string().optional(), phone: z.string().optional(),
        cscsCardType: z.string().optional(), projectId: z.number().optional(),
        hourlyRate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Project FK guard: if projectId is set, verify it belongs to companyId.
        // Mirrors the pattern used by defects.create / incidents.create.
        if (input.projectId !== undefined) {
          const [project] = await db.select().from(dbProjects)
            .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
            .limit(1);
          if (!project) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Project does not belong to this company.',
            });
          }
        }
        const rows = await db.insert(dbTeamMembers).values(input).returning();
        return rows[0];
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        name: z.string().optional(), role: z.string().optional(),
        trade: z.string().optional(), email: z.string().optional(),
        phone: z.string().optional(), status: z.enum(['active','inactive','on_leave']).optional(),
        hourlyRate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id, companyId, ...fields } = input;
        const clean: Record<string,unknown> = {};
        for (const [k,v] of Object.entries(fields)) if (v !== undefined) clean[k] = v;
        await db.update(dbTeamMembers)
          .set({ ...clean, updatedAt: new Date() })
          .where(and(eq(dbTeamMembers.id, id), eq(dbTeamMembers.companyId, companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbTeamMembers)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(and(eq(dbTeamMembers.id, input.id), eq(dbTeamMembers.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Permits ───────────────────────────────────────────────
  permits: router({
    list: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        status: z.enum(['draft','pending','active','expired','cancelled']).optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbPermits.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbPermits.projectId, input.projectId));
        if (input.status) conditions.push(eq(dbPermits.status, input.status));
        return db.select().from(dbPermits)
          .where(and(...conditions))
          .orderBy(desc(dbPermits.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number(), title: z.string(),
        type: z.enum(['hot_work','confined_space','excavation','working_at_height','electrical','general']),
        location: z.string().optional(), issuedBy: z.string().optional(),
        issuedTo: z.string().optional(), validFrom: z.string().optional(),
        validTo: z.string().optional(), conditions: z.string().optional(),
        riskLevel: z.enum(['low','medium','high','critical']).default('medium'),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Verify the project belongs to the requested company before inserting.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        const rows = await db.insert(dbPermits).values({
          ...input,
          validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
          validTo: input.validTo ? new Date(input.validTo) : undefined,
        }).returning();
        return rows[0];
      }),
    updateStatus: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        id: z.number(),
        status: z.enum(['draft','pending','active','expired','cancelled']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbPermits)
          .set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(dbPermits.id, input.id), eq(dbPermits.companyId, input.companyId)));
        return { success: true };
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        type: z.enum(['hot_work','confined_space','excavation','working_at_height','electrical','general']).optional(),
        location: z.string().nullable().optional(),
        issuedBy: z.string().nullable().optional(),
        issuedTo: z.string().nullable().optional(),
        validFrom: z.string().nullable().optional(),
        validTo: z.string().nullable().optional(),
        conditions: z.string().nullable().optional(),
        riskLevel: z.enum(['low','medium','high','critical']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, validFrom, validTo, ...rest } = input;
        const updateSet: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (validFrom !== undefined) updateSet.validFrom = validFrom === null ? null : new Date(validFrom);
        if (validTo !== undefined) updateSet.validTo = validTo === null ? null : new Date(validTo);
        await db.update(dbPermits).set(updateSet)
          .where(and(eq(dbPermits.id, input.id), eq(dbPermits.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbPermits)
          .where(and(eq(dbPermits.id, input.id), eq(dbPermits.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Daily Reports ─────────────────────────────────────────
  dailyReports: router({
    list: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        limit: z.number().default(20),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbDailyReports.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbDailyReports.projectId, input.projectId));
        return db.select().from(dbDailyReports)
          .where(and(...conditions))
          .orderBy(desc(dbDailyReports.reportDate))
          .limit(input.limit);
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number(), reportDate: z.string(),
        weather: z.string().optional(), temperature: z.number().optional(),
        workersOnSite: z.number().default(0),
        workCompleted: z.string().optional(),
        materialsUsed: z.string().optional(), issuesDelays: z.string().optional(),
        safetyObservations: z.string().optional(),
        nextDayPlan: z.string().optional(),
        visitors: z.string().optional(),
        photoUrls: z.string().default('[]'),
        submittedBy: z.string().default('Unknown'), status: z.enum(['draft','submitted','approved']).default('draft'),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        // The dailyReports table has no `visitors` column — fold it into safetyObservations
        // so the field round-trips without requiring a schema migration.
        const { submittedBy, visitors, safetyObservations, ...rest } = input;
        const safetyWithVisitors = visitors
          ? [safetyObservations || null, `Visitors: ${visitors}`]
              .filter((part): part is string => part !== null)
              .join('\n')
          : safetyObservations;
        const rows = await db.insert(dbDailyReports).values({
          ...rest,
          safetyObservations: safetyWithVisitors,
          submittedBy,
          reportDate: new Date(rest.reportDate),
        }).returning();
        return rows[0];
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        weather: z.string().nullable().optional(),
        temperature: z.number().nullable().optional(),
        workersOnSite: z.number().optional(),
        workCompleted: z.string().nullable().optional(),
        materialsUsed: z.string().nullable().optional(),
        issuesDelays: z.string().nullable().optional(),
        safetyObservations: z.string().nullable().optional(),
        nextDayPlan: z.string().nullable().optional(),
        photoUrls: z.string().optional(),
        status: z.enum(['draft','submitted','approved']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, ...rest } = input;
        await db.update(dbDailyReports).set(rest)
          .where(and(eq(dbDailyReports.id, input.id), eq(dbDailyReports.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbDailyReports)
          .where(and(eq(dbDailyReports.id, input.id), eq(dbDailyReports.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Tasks ─────────────────────────────────────────────────
  tasks: router({
    list: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbTasks.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbTasks.projectId, input.projectId));
        if (input.status) conditions.push(eq(dbTasks.status, input.status as any));
        return db.select().from(dbTasks)
          .where(and(...conditions))
          .orderBy(desc(dbTasks.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number(), title: z.string(), description: z.string().optional(),
        status: z.enum(['not_started','in_progress','completed','blocked','on_hold']).default('not_started'),
        priority: z.enum(['low','medium','high','critical']).default('medium'),
        assignedTo: z.string().optional(), dueDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        const rows = await db.insert(dbTasks).values({
          ...input,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        }).returning();
        return rows[0];
      }),
    updateStatus: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        id: z.number(),
        status: z.enum(['not_started','in_progress','completed','blocked','on_hold']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbTasks)
          .set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(dbTasks.id, input.id), eq(dbTasks.companyId, input.companyId)));
        return { success: true };
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(['not_started','in_progress','completed','blocked','on_hold']).optional(),
        priority: z.enum(['low','medium','high','critical']).optional(),
        assignedTo: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, dueDate, ...rest } = input;
        const updateSet: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (dueDate !== undefined) updateSet.dueDate = dueDate === null ? null : new Date(dueDate);
        await db.update(dbTasks).set(updateSet)
          .where(and(eq(dbTasks.id, input.id), eq(dbTasks.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbTasks)
          .where(and(eq(dbTasks.id, input.id), eq(dbTasks.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Inspections ───────────────────────────────────────────
  inspections: router({
    list: companyScopedProcedure
      .input(z.object({ projectId: z.number().optional(), companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbInspections.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbInspections.projectId, input.projectId));
        return db.select().from(dbInspections).where(and(...conditions)).orderBy(desc(dbInspections.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(), projectId: z.number(),
        title: z.string(),
        type: z.string().default('general'), checklistItems: z.string().optional(),
        notes: z.string().optional(), scheduledAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard: a member of company A must not be able
        // to schedule an inspection against company B's project. Mirrors
        // the same check in incidents.create / tasks.create / files.upload
        // / documents.saveGenerated / defects.create. companyScopedProcedure
        // gates by company-membership but does not verify cross-references.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        // Conductor is always the authenticated user. Previously the
        // procedure took `conductedById` from input with `.default(1)`,
        // letting any signed-in caller forge attribution OR silently
        // attribute to user 1 (super-admin) when omitted.
        const rows = await db.insert(dbInspections).values({
          ...input,
          conductedById: ctx.user.id,
          status: 'scheduled',
        }).returning();
        return rows[0];
      }),
    complete: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        checklistItems: z.string(), overallResult: z.string(),
        notes: z.string().optional(), photoUrls: z.string().default('[]'),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbInspections).set({
          checklistItems: input.checklistItems, overallResult: input.overallResult,
          notes: input.notes, photoUrls: input.photoUrls,
          status: 'completed', completedAt: new Date(), updatedAt: new Date(),
        }).where(and(eq(dbInspections.id, input.id), eq(dbInspections.companyId, input.companyId)));
        return { success: true };
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        type: z.string().optional(),
        checklistItems: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        scheduledAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, scheduledAt, ...rest } = input;
        const updateSet: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (scheduledAt !== undefined) updateSet.scheduledAt = scheduledAt === null ? null : new Date(scheduledAt);
        await db.update(dbInspections).set(updateSet)
          .where(and(eq(dbInspections.id, input.id), eq(dbInspections.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbInspections)
          .where(and(eq(dbInspections.id, input.id), eq(dbInspections.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: RFIs ──────────────────────────────────────────────────
  rfis: router({
    list: companyScopedProcedure
      .input(z.object({ projectId: z.number().optional(), companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbRfis.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbRfis.projectId, input.projectId));
        return db.select().from(dbRfis).where(and(...conditions)).orderBy(desc(dbRfis.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(), projectId: z.number(),
        subject: z.string(),
        question: z.string(), priority: z.string().default('normal'),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard: a member of company A must not be able
        // to raise an RFI against company B's project. Mirrors the same
        // check in inspections.create / observations.create / etc.
        // companyScopedProcedure gates by company-membership but does
        // not verify cross-references.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        const count = await db.select({ c: sql<number>`count(*)` }).from(dbRfis).where(eq(dbRfis.companyId, input.companyId));
        const num = `RFI-${String((Number(count[0]?.c ?? 0) + 1)).padStart(4,'0')}`;
        // Raiser is always the authenticated user — see PR description.
        const rows = await db.insert(dbRfis).values({
          ...input,
          raisedById: ctx.user.id,
          number: num,
        }).returning();

        // Phase 3.4 — fire-and-forget broadcast to every active manager+
        // / company_admin / super_admin in the company. Lower ranks don't
        // get notified to keep inbox noise sane. The hierarchy lives in
        // server/_core/role-check.ts#ROLE_LEVELS (mirror of the UI copy
        // in lib/company-context.tsx#ROLE_LEVELS).
        const recipients = await safeRecipients(
          () => recipientsByCompanyRole(db, input.companyId, "manager"),
          "rfis.create",
        );
        void notify({
          to: recipients,
          channels: {
            email: {
              template: (r) => ({
                to: r.email ?? "",
                ...rfiSubmittedEmail({
                  rfi: { id: rows[0].id, number: rows[0].number, subject: rows[0].subject },
                  raiser: { name: ctx.user.name },
                  project: { name: project.name },
                  recipient: { name: r.name },
                }),
              }),
            },
          },
          context: "rfis.create",
        });

        return rows[0];
      }),
    answer: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), response: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "manager");
        const db = await getDb();
        if (!db) throw dbUnavailable();

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "answered");

        await db.update(dbRfis).set({
          response: input.response,
          status: "answered",
          respondedAt: new Date(),
          answeredById: ctx.user.id,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        // Fire-and-forget email to the raiser via the gateway.
        const recipients = await safeRecipients(
          () => recipientsByUserIds(db, [rfi.raisedById]),
          "rfis.answer",
        );
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);
        void notify({
          to: recipients,
          channels: {
            email: {
              template: (r) => ({
                to: r.email ?? "",
                ...rfiAnsweredEmail({
                  rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject },
                  answerer: { name: ctx.user.name },
                  raiser: { name: r.name },
                  project: { name: project?.name ?? "" },
                  recipient: { name: r.name },
                }),
              }),
            },
          },
          context: "rfis.answer",
        });

        return { success: true };
      }),

    /**
     * @deprecated Phase 3.4 — alias of `answer`. In-flight mobile
     * clients still call `respond`; this delegate keeps them working
     * until the next EAS update lands. Drop in a follow-up commit
     * once telemetry shows no callers.
     *
     * Implementation note: inlined rather than delegating via
     * `appRouter.createCaller` to avoid a circular type inference error
     * (TS7022 "implicitly has type 'any' because it does not have a type
     * annotation and is referenced directly or indirectly in its own
     * initializer"). The logic is identical to `answer` above.
     */
    respond: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), response: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "manager");
        const db = await getDb();
        if (!db) throw dbUnavailable();

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "answered");

        await db.update(dbRfis).set({
          response: input.response,
          status: "answered",
          respondedAt: new Date(),
          answeredById: ctx.user.id,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        const recipients = await safeRecipients(
          () => recipientsByUserIds(db, [rfi.raisedById]),
          "rfis.respond",
        );
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);
        void notify({
          to: recipients,
          channels: {
            email: {
              template: (r) => ({
                to: r.email ?? "",
                ...rfiAnsweredEmail({
                  rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject },
                  answerer: { name: ctx.user.name },
                  raiser: { name: r.name },
                  project: { name: project?.name ?? "" },
                  recipient: { name: r.name },
                }),
              }),
            },
          },
          context: "rfis.respond",
        });

        return { success: true };
      }),
    approve: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "company_admin");
        const db = await getDb();
        if (!db) throw dbUnavailable();

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "approved");

        await db.update(dbRfis).set({
          status: "approved",
          approvedAt: new Date(),
          approvedById: ctx.user.id,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        // Fire-and-forget email to raiser + answerer via the gateway.
        const recipients = await safeRecipients(
          () => recipientsByUserIds(db, [rfi.raisedById, rfi.answeredById]),
          "rfis.approve",
        );
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);
        void notify({
          to: recipients,
          channels: {
            email: {
              template: (r) => ({
                to: r.email ?? "",
                ...rfiApprovedEmail({
                  rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject },
                  approver: { name: ctx.user.name },
                  project: { name: project?.name ?? "" },
                  recipient: { name: r.name },
                }),
              }),
            },
          },
          context: "rfis.approve",
        });

        return { success: true };
      }),
    reject: companyScopedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        reason: z.string().min(1, "rejection reason is required"),
      }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "company_admin");
        const db = await getDb();
        if (!db) throw dbUnavailable();

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "rejected");

        await db.update(dbRfis).set({
          status: "rejected",
          rejectedAt: new Date(),
          rejectedById: ctx.user.id,
          rejectedReason: input.reason,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        // Fire-and-forget email to raiser + answerer via the gateway.
        const recipients = await safeRecipients(
          () => recipientsByUserIds(db, [rfi.raisedById, rfi.answeredById]),
          "rfis.reject",
        );
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);
        void notify({
          to: recipients,
          channels: {
            email: {
              template: (r) => ({
                to: r.email ?? "",
                ...rfiRejectedEmail({
                  rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject, rejectedReason: input.reason },
                  rejecter: { name: ctx.user.name },
                  project: { name: project?.name ?? "" },
                  recipient: { name: r.name },
                }),
              }),
            },
          },
          context: "rfis.reject",
        });

        return { success: true };
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        subject: z.string().min(1).optional(),
        question: z.string().min(1).optional(),
        priority: z.string().optional(),
        dueDate: z.string().nullable().optional(),
        // Optional offline-sync snapshot — set by the queue replay path
        // (lib/sync-queue.tsx). When present, the procedure runs the
        // field-level conflict detector against the row's current state
        // and either applies cleanly, parks a conflict_pending row, or
        // reports row_deleted. Online callers omit this and get the
        // original behaviour.
        baseSnapshot: z.object({
          updatedAt: z.string(),
          originalValues: z.record(z.string(), z.unknown()),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id, companyId, baseSnapshot, dueDate, ...rest } = input;

        const userPayload: Record<string, unknown> = { ...rest };
        if (dueDate !== undefined) userPayload.dueDate = dueDate === null ? null : new Date(dueDate);

        if (baseSnapshot) {
          return await db.transaction(async (tx) => {
            const rows = await tx.select().from(dbRfis)
              .where(and(eq(dbRfis.id, id), eq(dbRfis.companyId, companyId)))
              .limit(1)
              .for('update');
            const currentRow = rows[0];

            const detection = detectFieldConflicts(
              currentRow ?? null,
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
              const [inserted] = await tx.insert(dbConflictPending).values({
                companyId,
                userId: ctx.user.id,
                tableName: 'rfis',
                rowId: id,
                conflictFields: detection.fields,
                mineValues: minePicked,
                theirsValues: detection.theirsValues,
                baseUpdatedAt: new Date(baseSnapshot.updatedAt),
              }).returning({ id: dbConflictPending.id });
              return {
                status: 'conflict' as const,
                conflictId: inserted.id,
                fields: detection.fields,
              };
            }

            await tx.update(dbRfis)
              .set({ ...userPayload, updatedAt: new Date() })
              .where(and(eq(dbRfis.id, id), eq(dbRfis.companyId, companyId)));
            return { success: true as const };
          });
        }

        // Original online path — no snapshot, no conflict detection.
        await db.update(dbRfis)
          .set({ ...userPayload, updatedAt: new Date() })
          .where(and(eq(dbRfis.id, id), eq(dbRfis.companyId, companyId)));
        return { success: true as const };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Observations ─────────────────────────────────────────
  observations: router({
    list: companyScopedProcedure
      .input(z.object({ projectId: z.number().optional(), companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbObservations.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbObservations.projectId, input.projectId));
        return db.select().from(dbObservations).where(and(...conditions)).orderBy(desc(dbObservations.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(), projectId: z.number(),
        type: z.string().default('positive'),
        title: z.string(), description: z.string().optional(),
        location: z.string().optional(), photoUrls: z.string().default('[]'),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard: a member of company A must not be able
        // to log an observation against company B's project. Mirrors the
        // same check in incidents.create / tasks.create / files.upload /
        // documents.saveGenerated / defects.create / inspections.create.
        // companyScopedProcedure gates by company-membership but does not
        // verify cross-references.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        const rows = await db.insert(dbObservations).values({
          ...input,
          observedById: ctx.user.id,
        }).returning();
        return rows[0];
      }),
    updateStatus: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), status: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.update(dbObservations)
          .set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(dbObservations.id, input.id), eq(dbObservations.companyId, input.companyId)));
        return { success: true };
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        type: z.string().optional(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        photoUrls: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, ...rest } = input;
        await db.update(dbObservations).set({ ...rest, updatedAt: new Date() })
          .where(and(eq(dbObservations.id, input.id), eq(dbObservations.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbObservations)
          .where(and(eq(dbObservations.id, input.id), eq(dbObservations.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Drawings ──────────────────────────────────────────────
  drawings: router({
    list: companyScopedProcedure
      .input(z.object({ projectId: z.number().optional(), companyId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbDrawings.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbDrawings.projectId, input.projectId));
        return db.select().from(dbDrawings).where(and(...conditions)).orderBy(desc(dbDrawings.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(), projectId: z.number(),
        title: z.string(),
        drawingNumber: z.string().optional(), revision: z.string().optional(),
        discipline: z.string().optional(), fileUrl: z.string(),
        thumbnailUrl: z.string().optional(), fileSize: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard: a member of company A must not be able
        // to attach a drawing to company B's project. companyScopedProcedure
        // gates by company-membership but doesn't verify the projectId.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        const rows = await db.insert(dbDrawings).values({
          ...input,
          uploadedById: ctx.user.id,
        }).returning();
        return rows[0];
      }),
    /**
     * Edit metadata on an existing drawing — title, drawing number,
     * revision, discipline, and the file pointer (if the user is
     * uploading a replacement). Same partial-write rule as
     * announcements.update: only fields actually present in input are
     * written, so editing just the title can't clobber the revision.
     *
     * `uploadedById` is intentionally NOT updatable — it's the
     * provenance trail for the original upload.
     */
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        drawingNumber: z.string().optional(),
        revision: z.string().optional(),
        discipline: z.string().optional(),
        fileUrl: z.string().min(1).optional(),
        thumbnailUrl: z.string().optional(),
        fileSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, ...rest } = input;
        await db.update(dbDrawings).set({ ...rest, updatedAt: new Date() })
          .where(and(eq(dbDrawings.id, input.id), eq(dbDrawings.companyId, input.companyId)));
        return { success: true };
      }),
    /**
     * Delete a drawing. Tenant-safe via `companyId` in the WHERE.
     *
     * NOTE on file storage: the row points to a `storage/<key>` URL
     * (or legacy `manus-storage/<key>` for older rows), but
     * `server/storage.ts` intentionally has no delete helper.
     * Removing the row leaves the file orphaned; that's acceptable for
     * now (the storage layer can be GC'd separately) and matches the
     * behaviour of every other delete on this router.
     */
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbDrawings)
          .where(and(eq(dbDrawings.id, input.id), eq(dbDrawings.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Announcements ─────────────────────────────────────────
  announcements: router({
    list: companyScopedProcedure
      .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbAnnouncements.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbAnnouncements.projectId, input.projectId));
        return db.select().from(dbAnnouncements).where(and(...conditions)).orderBy(desc(dbAnnouncements.isPinned), desc(dbAnnouncements.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(), projectId: z.number().optional(),
        title: z.string(), body: z.string(),
        priority: z.string().default('normal'), isPinned: z.boolean().default(false),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard, when projectId is provided. A member
        // of company A must not be able to scope an announcement to
        // company B's project. Skipped for company-wide announcements
        // (no projectId) where the announcement is intentionally
        // company-scoped, not project-scoped.
        if (input.projectId !== undefined) {
          const [project] = await db.select().from(dbProjects)
            .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
            .limit(1);
          if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });
        }

        const rows = await db.insert(dbAnnouncements).values({
          ...input,
          createdById: ctx.user.id,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        }).returning();
        return rows[0];
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbAnnouncements)
          .where(and(eq(dbAnnouncements.id, input.id), eq(dbAnnouncements.companyId, input.companyId)));
        return { success: true };
      }),
    /**
     * Update an existing announcement. All editable fields are optional;
     * only the keys actually present in the input are written, so a
     * caller editing just the body doesn't accidentally clobber the
     * priority or pin state. Author (`createdById`) and timestamps are
     * never editable through this procedure.
     *
     * Tenant safety: the WHERE clause filters BOTH the row id AND the
     * companyId, so a caller from company A cannot edit company B's
     * announcement by guessing an id (companyScopedProcedure already
     * verified the caller's membership in `input.companyId`, but the
     * id-belongs-to-this-company filter is the second lock).
     */
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        title: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        priority: z.string().optional(),
        isPinned: z.boolean().optional(),
        expiresAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, expiresAt, ...rest } = input;
        const updateSet: Record<string, unknown> = {
          ...rest,
          updatedAt: new Date(),
        };
        // Only write expiresAt if it was actually present in the input —
        // null means "clear the expiry", undefined means "don't touch".
        if (expiresAt !== undefined) {
          updateSet.expiresAt = expiresAt === null ? null : new Date(expiresAt);
        }
        await db.update(dbAnnouncements).set(updateSet)
          .where(and(eq(dbAnnouncements.id, input.id), eq(dbAnnouncements.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Project Bookmarks ─────────────────────────────────────
  bookmarks: router({
    list: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        // Owner is always the authenticated caller — accepting `userId`
        // from input would let any logged-in user read another user's
        // bookmarks (`bookmarks.list` was previously protected only by
        // companyScopedProcedure, so cross-tenant was caught but
        // cross-user-within-the-same-company was not).
        const conditions = [
          eq(dbProjectBookmarks.companyId, input.companyId),
          eq(dbProjectBookmarks.userId, ctx.user.id),
        ];
        if (input.projectId) conditions.push(eq(dbProjectBookmarks.projectId, input.projectId));
        return db.select().from(dbProjectBookmarks).where(and(...conditions)).orderBy(desc(dbProjectBookmarks.createdAt));
      }),
    add: companyScopedProcedure
      .input(z.object({
        companyId: z.number(),
        projectId: z.number(),
        itemType: z.string(),
        itemId: z.string(),
        itemTitle: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Same `ctx.user.id` ownership rule as `list` above — drop any
        // client-supplied userId and use the session.
        const existing = await db.select().from(dbProjectBookmarks).where(and(
          eq(dbProjectBookmarks.companyId, input.companyId),
          eq(dbProjectBookmarks.userId, ctx.user.id),
          eq(dbProjectBookmarks.projectId, input.projectId),
          eq(dbProjectBookmarks.itemType, input.itemType),
          eq(dbProjectBookmarks.itemId, input.itemId),
        )).limit(1);
        if (existing[0]) return existing[0];
        const rows = await db.insert(dbProjectBookmarks).values({
          ...input,
          userId: ctx.user.id,
        }).returning();
        return rows[0];
      }),
    remove: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbProjectBookmarks)
          .where(and(
            eq(dbProjectBookmarks.id, input.id),
            eq(dbProjectBookmarks.companyId, input.companyId),
            eq(dbProjectBookmarks.userId, ctx.user.id),
          ));
        return { success: true };
      }),
  }),

  // ─── Live Database: Action Plans ──────────────────────────────────────────
  actionPlans: router({
    list: companyScopedProcedure
      .input(z.object({ projectId: z.number().optional(), companyId: z.number(), status: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(dbActionPlans.companyId, input.companyId)];
        if (input.projectId) conditions.push(eq(dbActionPlans.projectId, input.projectId));
        if (input.status) conditions.push(eq(dbActionPlans.status, input.status));
        return db.select().from(dbActionPlans).where(and(...conditions)).orderBy(desc(dbActionPlans.createdAt));
      }),
    create: companyScopedProcedure
      .input(z.object({
        companyId: z.number(), projectId: z.number(),
        // assignedToId stays client-provided (it's a delegation target,
        // not an identity claim). createdById is dropped — the actor is
        // always the authenticated caller, sourced from ctx below.
        assignedToId: z.number().optional(),
        title: z.string(), description: z.string().optional(),
        linkedTo: z.string().optional(), linkedId: z.number().optional(),
        priority: z.string().default('medium'), dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        // Cross-tenant FK guard: a member of company A must not be able
        // to attach an action plan to company B's project. Mirrors the
        // same check in inspections.create / observations.create / etc.
        const [project] = await db.select().from(dbProjects)
          .where(and(eq(dbProjects.id, input.projectId), eq(dbProjects.companyId, input.companyId)))
          .limit(1);
        if (!project) throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });

        const rows = await db.insert(dbActionPlans).values({
          ...input,
          createdById: ctx.user.id,
        }).returning();
        return rows[0];
      }),
    updateStatus: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), status: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const update: Record<string,unknown> = { status: input.status, updatedAt: new Date() };
        if (input.status === 'completed') update.completedAt = new Date();
        await db.update(dbActionPlans).set(update)
          .where(and(eq(dbActionPlans.id, input.id), eq(dbActionPlans.companyId, input.companyId)));
        return { success: true };
      }),
    update: companyScopedProcedure
      .input(z.object({
        id: z.number(), companyId: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        assignedToId: z.number().nullable().optional(),
        linkedTo: z.string().nullable().optional(),
        linkedId: z.number().nullable().optional(),
        priority: z.string().optional(),
        dueDate: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        const { id: _id, companyId: _c, dueDate, ...rest } = input;
        const updateSet: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (dueDate !== undefined) updateSet.dueDate = dueDate === null ? null : new Date(dueDate);
        await db.update(dbActionPlans).set(updateSet)
          .where(and(eq(dbActionPlans.id, input.id), eq(dbActionPlans.companyId, input.companyId)));
        return { success: true };
      }),
    delete: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw dbUnavailable();
        await db.delete(dbActionPlans)
          .where(and(eq(dbActionPlans.id, input.id), eq(dbActionPlans.companyId, input.companyId)));
        return { success: true };
      }),
  }),

  // ─── Live Database: Finance (Invoices + Tenders) ──────────────────────────
  finance: financeRouter,
  // ─── Live Database: Enquiries / Pipeline ──────────────────────────────────
  enquiries: enquiriesRouter,
  // ─── Live Database: Companies (cross-membership listing for switcher) ─────
  companies: companiesRouter,
  // ─── Live Database: Materials Delivery Tracking (Phase 3.2) ───────────────
  materials: materialsRouter,
  // ─── Live Database: Equipment Management ───────────────────────────────
  equipment: equipmentRouter,
});
export type AppRouter = typeof appRouter;
