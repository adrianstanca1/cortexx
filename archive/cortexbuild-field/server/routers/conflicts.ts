/**
 * Conflicts router — Phase 3.7 offline-sync conflict resolution.
 *
 * `list` returns the current user's parked or resolved conflicts (driven by
 * the `resolved` flag). `resolve` applies user-supplied finalValues to the
 * source row through the same diff dispatcher as the original mutation, so
 * a third writer racing the resolution itself produces a fresh conflict
 * (recursion handles it without a special-case path).
 *
 * Both procedures are tenant-scoped via `companyScopedProcedure`. Cross-
 * tenant reads/writes return FORBIDDEN: the membership check sees no row.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { companyScopedProcedure, router } from "../_core/trpc";
import { dbUnavailable } from "../_core/errors";
import { getDb } from "../db";
import {
  conflictPending as dbConflictPending,
  rfis as dbRfis,
} from "../../drizzle/schema";
import { detectFieldConflicts } from "../_core/sync-conflict-detector";

export const conflictsRouter = router({
  /**
   * List the current user's conflicts.
   *   resolved=false (default) → only those still awaiting resolution.
   *   resolved=true → resolved history (audit; up to 30 days retention).
   */
  list: companyScopedProcedure
    .input(z.object({
      companyId: z.number(),
      resolved: z.boolean().optional().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const filter = input.resolved
        ? isNotNull(dbConflictPending.resolvedAt)
        : isNull(dbConflictPending.resolvedAt);

      return await db
        .select()
        .from(dbConflictPending)
        .where(and(
          eq(dbConflictPending.companyId, input.companyId),
          eq(dbConflictPending.userId, ctx.user.id),
          filter,
        ))
        .orderBy(desc(dbConflictPending.createdAt));
    }),

  /**
   * Apply finalValues to the source row and mark the conflict resolved.
   *
   * Goes through detectFieldConflicts again — if a third writer changed the
   * same field while the user was filling out the resolution sheet, this
   * produces a NEW conflict_pending row and leaves the old one unresolved.
   * Caller learns about the recursion via { ok: false, recursiveConflictId }.
   */
  resolve: companyScopedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      companyId: z.number(),
      finalValues: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      return await db.transaction(async (tx) => {
        // 1. Fetch + lock the conflict row, scoped to user/company.
        const pendingRows = await tx
          .select()
          .from(dbConflictPending)
          .where(and(
            eq(dbConflictPending.id, input.id),
            eq(dbConflictPending.companyId, input.companyId),
            eq(dbConflictPending.userId, ctx.user.id),
          ))
          .limit(1)
          .for("update");
        const pending = pendingRows[0];

        if (!pending) {
          throw new TRPCError({ code: "FORBIDDEN", message: "CONFLICT_NOT_FOUND" });
        }
        if (pending.resolvedAt !== null) {
          throw new TRPCError({ code: "CONFLICT", message: "CONFLICT_ALREADY_RESOLVED" });
        }

        // 2. Apply finalValues through the same diff dispatcher.
        //    Single-table dispatch for now (rfis); generalize as more
        //    tables get queueable in later phases.
        if (pending.tableName !== "rfis") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `unsupported tableName: ${pending.tableName}`,
          });
        }

        const sourceRows = await tx.select().from(dbRfis)
          .where(and(eq(dbRfis.id, pending.rowId), eq(dbRfis.companyId, input.companyId)))
          .limit(1)
          .for("update");
        const sourceRow = sourceRows[0] ?? null;

        const detection = detectFieldConflicts(
          sourceRow,
          pending.baseUpdatedAt,
          input.finalValues,
          // For resolution, "snapshot" is theirsValues — what we believed the row
          // looked like when the conflict was first parked. If a third writer
          // has moved the field again, recursion fires.
          pending.theirsValues as Record<string, unknown>,
        );

        if (detection.kind === "row_deleted") {
          await tx.update(dbConflictPending)
            .set({ resolvedAt: new Date() })
            .where(eq(dbConflictPending.id, pending.id));
          return { ok: true as const, sourceDeleted: true };
        }

        if (detection.kind === "conflict") {
          const minePicked: Record<string, unknown> = {};
          for (const f of detection.fields) {
            if (f in input.finalValues) minePicked[f] = input.finalValues[f];
          }
          const [newConflict] = await tx
            .insert(dbConflictPending)
            .values({
              companyId: input.companyId,
              userId: ctx.user.id,
              tableName: pending.tableName,
              rowId: pending.rowId,
              conflictFields: detection.fields,
              mineValues: minePicked,
              theirsValues: detection.theirsValues,
              baseUpdatedAt: pending.baseUpdatedAt,
            })
            .returning({ id: dbConflictPending.id });

          return { ok: false as const, recursiveConflictId: newConflict.id };
        }

        // 3. Apply the user's final values to the source row.
        await tx.update(dbRfis)
          .set({ ...input.finalValues, updatedAt: new Date() })
          .where(and(eq(dbRfis.id, pending.rowId), eq(dbRfis.companyId, input.companyId)));
        await tx.update(dbConflictPending)
          .set({ resolvedAt: new Date() })
          .where(eq(dbConflictPending.id, pending.id));

        return { ok: true as const };
      });
    }),
});
