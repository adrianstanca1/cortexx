import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { companyScopedProcedure, router } from "../_core/trpc";
import { dbUnavailable } from "../_core/errors";
import { getDb } from "../db";
import {
  invoices as dbInvoices,
  tenders as dbTenders,
  projects as dbProjects,
  timesheets as dbTimesheets,
  defects as dbDefects,
  incidents as dbIncidents,
  checkIns as dbCheckIns,
} from "../../drizzle/schema";
import {
  computeCisDeduction,
  invoiceLineItemSchema,
  labourSubtotal,
  type CisStatus,
} from "../../shared/cis";

/**
 * Adapter: the legacy createInvoice schema uses `cisDeductionRate: number`.
 * Map that to a CisStatus so the central helper can do the math.
 *   20 → 'registered_20', 30 → 'registered_30', 0 → 'gross_payment',
 *   anything else → 'none' (validation effectively skipped — caller error).
 */
function cisStatusFromRate(rate: number | undefined): CisStatus {
  if (rate === 20) return "registered_20";
  if (rate === 30) return "registered_30";
  if (rate === 0) return "gross_payment";
  return "none";
}

export const financeRouter = router({
  listInvoices: companyScopedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dbInvoices.companyId, input.companyId)];
      if (input.projectId) conditions.push(eq(dbInvoices.projectId, input.projectId));
      if (input.status) conditions.push(eq(dbInvoices.status, input.status));
      return db.select().from(dbInvoices).where(and(...conditions)).orderBy(desc(dbInvoices.createdAt));
    }),
  createInvoice: companyScopedProcedure
    .input(z.object({
      companyId: z.number(), projectId: z.number().optional(),
      invoiceNumber: z.string(),
      // Enumerable so the receipt-bypass key on the CIS gate (line 81) is
      // auditable: only 'receipt' callers skip validation, and only the
      // receipt-scanner UI sets it. Adding a new type later is a deliberate
      // schema change rather than a string literal anyone can pass.
      type: z.enum(['invoice', 'receipt']).default('invoice'),
      clientName: z.string().optional(),
      clientEmail: z.string().optional(), issueDate: z.string().optional(),
      dueDate: z.string().optional(), vatRate: z.string().default('standard_20'),
      isCisJob: z.boolean().default(false), cisDeductionRate: z.number().default(0),
      subtotal: z.string().default('0'), vatAmount: z.string().default('0'),
      total: z.string().default('0'), netPayable: z.string().default('0'),
      cisDeductionAmount: z.string().optional(), photoUrl: z.string().optional(),
      aiExtracted: z.boolean().optional(),
      lineItems: z.array(invoiceLineItemSchema).optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      // CIS integrity gate: when isCisJob is true AND structured lineItems are
      // provided, re-derive the deduction from the labour subtotal and reject
      // any caller-supplied amount that disagrees by more than £0.01. The
      // tolerance accommodates float rounding without permitting drift.
      //
      // `lineItems: undefined` is the back-compat bypass (legacy clients send a
      // string total without itemisation). `lineItems: []` is NOT a bypass — it
      // means "I told you my labour is zero", so any nonzero cisDeductionAmount
      // is a contradiction and must be rejected.
      //
      // Receipts (type === 'receipt') ALSO bypass the gate: a receipt records
      // what an EXTERNAL supplier billed, and the user has no authority to
      // rewrite the supplier's CIS arithmetic. The receipt-scanner UI surfaces
      // a non-blocking warning banner if the supplier's number disagrees with
      // labour×rate (see app/receipt-scanner.tsx) — but persistence captures
      // the supplier's value verbatim.
      if (input.isCisJob && input.type !== "receipt" && input.lineItems !== undefined) {
        const expected = computeCisDeduction({
          labourSubtotal: labourSubtotal(input.lineItems),
          status: cisStatusFromRate(input.cisDeductionRate),
        });
        const supplied = parseFloat(input.cisDeductionAmount ?? "0");
        if (Math.abs(expected - supplied) > 0.01) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `cisDeductionAmount £${supplied.toFixed(2)} disagrees with labour-subtotal-derived £${expected.toFixed(2)}`,
          });
        }
      }

      // Author is always the authenticated caller, never trusted from
      // input. Previously `createdById: z.number().default(1)` let any
      // user attribute an invoice to anyone (including super-admin
      // user-id 1 if the field was simply omitted).
      const rows = await db.insert(dbInvoices).values({
        ...input,
        createdById: ctx.user.id,
      }).returning();
      return rows[0];
    }),
  updateInvoiceStatus: companyScopedProcedure
    .input(z.object({ id: z.number(), companyId: z.number(), status: z.string(), approvedById: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const update: Record<string, unknown> = { status: input.status, updatedAt: new Date() };
      if (input.status === 'approved') { update.approvedById = input.approvedById; update.approvedAt = new Date(); }
      if (input.status === 'paid') update.paidAt = new Date();
      await db.update(dbInvoices).set(update)
        .where(and(eq(dbInvoices.id, input.id), eq(dbInvoices.companyId, input.companyId)));
      return { success: true };
    }),
  listTenders: companyScopedProcedure
    .input(z.object({ companyId: z.number(), status: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dbTenders.companyId, input.companyId)];
      if (input.status) conditions.push(eq(dbTenders.status, input.status));
      return db.select().from(dbTenders).where(and(...conditions)).orderBy(desc(dbTenders.createdAt));
    }),
  createTender: companyScopedProcedure
    .input(z.object({
      companyId: z.number(), projectId: z.number().optional(),
      title: z.string(),
      clientName: z.string().optional(), totalValue: z.string().optional(),
      lineItems: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      // Author from ctx — see createInvoice above for rationale.
      const rows = await db.insert(dbTenders).values({
        ...input,
        createdById: ctx.user.id,
      }).returning();
      return rows[0];
    }),
  analyticsOverview: companyScopedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [projects, timesheets, defects, incidents, checkins] = await Promise.all([
        db.select().from(dbProjects),
        db.select().from(dbTimesheets).where(eq(dbTimesheets.companyId, input.companyId)),
        db.select().from(dbDefects),
        db.select().from(dbIncidents),
        db.select().from(dbCheckIns),
      ]);
      const activeProjects = projects.filter(p => p.status === 'active');
      const totalBudget = projects.reduce((s, p) => s + Number(p.budget ?? 0), 0);
      const totalSpent = projects.reduce((s, p) => s + Number(p.spent ?? 0), 0);
      const openDefects = defects.filter(d => d.status === 'open').length;
      const openIncidents = incidents.filter(i => i.status === 'open').length;
      const totalHours = timesheets.reduce((s, t) => s + Number(t.totalHours ?? 0), 0);
      return {
        totalProjects: projects.length, activeProjects: activeProjects.length,
        totalBudget, totalSpent, budgetVariance: totalBudget - totalSpent,
        openDefects, openIncidents, totalHours,
        checkInsToday: checkins.filter(c => {
          const d = new Date(c.checkInTime ?? c.createdAt);
          const today = new Date();
          return d.toDateString() === today.toDateString();
        }).length,
        projects: projects.map(p => ({
          id: p.id, name: p.name, status: p.status,
          budget: Number(p.budget ?? 0), spent: Number(p.spent ?? 0),
          progress: p.progress ?? 0,
        })),
      };
    }),
});
