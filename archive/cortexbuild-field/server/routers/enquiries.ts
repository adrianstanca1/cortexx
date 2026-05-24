import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { companyScopedProcedure, router } from "../_core/trpc";
import { dbUnavailable } from "../_core/errors";
import { getDb } from "../db";
import {
  enquiries as dbEnquiries,
  enquiryPipelines as dbEnquiryPipelines,
} from "../../drizzle/schema";

export const enquiriesRouter = router({
  listPipelines: companyScopedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(dbEnquiryPipelines).where(eq(dbEnquiryPipelines.companyId, input.companyId));
    }),
  createPipeline: companyScopedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      stages: z.array(z.string()).default(['New Enquiry', 'Quoted', 'Follow-up', 'Won', 'Lost']),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const rows = await db.insert(dbEnquiryPipelines).values({
        companyId: input.companyId,
        name: input.name,
        stages: JSON.stringify(input.stages),
        isDefault: input.isDefault,
      }).returning();
      return rows[0];
    }),
  list: companyScopedProcedure
    .input(z.object({ companyId: z.number(), pipelineId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dbEnquiries.companyId, input.companyId)];
      if (input.pipelineId) conditions.push(eq(dbEnquiries.pipelineId, input.pipelineId));
      if (input.status) conditions.push(eq(dbEnquiries.status, input.status));
      return db.select().from(dbEnquiries).where(and(...conditions)).orderBy(desc(dbEnquiries.createdAt));
    }),
  create: companyScopedProcedure
    .input(z.object({
      companyId: z.number(), pipelineId: z.number(),
      clientName: z.string(), clientEmail: z.string().optional(),
      clientPhone: z.string().optional(), title: z.string(),
      description: z.string().optional(), value: z.string().optional(),
      stage: z.string(), source: z.string().default('manual'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const rows = await db.insert(dbEnquiries).values(input).returning();
      return rows[0];
    }),
  updateStage: companyScopedProcedure
    .input(z.object({ id: z.number(), companyId: z.number(), stage: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await db.update(dbEnquiries).set({ stage: input.stage, updatedAt: new Date() })
        .where(and(eq(dbEnquiries.id, input.id), eq(dbEnquiries.companyId, input.companyId)));
      return { success: true };
    }),
});
