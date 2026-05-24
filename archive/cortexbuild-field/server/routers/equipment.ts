import { z } from 'zod';
import { router } from '../_core/trpc';
import { companyScopedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { equipment, equipmentAssignments, equipmentServiceLogs } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

function dbUnavailable() {
  return new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' });
}

export const equipmentRouter = router({
  list: companyScopedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(equipment.companyId, input.companyId)];
      if (input.projectId) conditions.push(eq(equipment.projectId, input.projectId));
      if (input.status) conditions.push(eq(equipment.status, input.status as any));
      return db.select().from(equipment).where(and(...conditions)).orderBy(desc(equipment.createdAt));
    }),

  create: companyScopedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      category: z.enum(['plant','tool','vehicle','ppe','scaffold','other']).default('tool'),
      status: z.enum(['available','rented','in_use','maintenance','retired']).default('available'),
      serialNumber: z.string().optional(),
      manufacturer: z.string().optional(),
      model: z.string().optional(),
      purchaseDate: z.string().optional(),
      rentalRate: z.number().optional(),
      dailyRate: z.number().optional(),
      location: z.string().optional(),
      projectId: z.number().optional(),
      description: z.string().optional(),
      qrCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const rows = await db.insert(equipment).values({
        companyId: input.companyId,
        name: input.name,
        category: input.category as any,
        status: input.status as any,
        serialNumber: input.serialNumber,
        manufacturer: input.manufacturer,
        model: input.model,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
        rentalRate: input.rentalRate?.toString() as any,
        dailyRate: input.dailyRate?.toString() as any,
        location: input.location,
        projectId: input.projectId,
        description: input.description,
        qrCode: input.qrCode,
      }).returning();
      return rows[0];
    }),

  update: companyScopedProcedure
    .input(z.object({
      id: z.number(), companyId: z.number(),
      name: z.string().min(1).optional(),
      category: z.enum(['plant','tool','vehicle','ppe','scaffold','other']).optional(),
      status: z.enum(['available','rented','in_use','maintenance','retired']).optional(),
      serialNumber: z.string().nullable().optional(),
      manufacturer: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      purchaseDate: z.string().nullable().optional(),
      rentalRate: z.number().nullable().optional(),
      dailyRate: z.number().nullable().optional(),
      location: z.string().nullable().optional(),
      projectId: z.number().nullable().optional(),
      description: z.string().nullable().optional(),
      qrCode: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const { id, companyId, ...rest } = input;
      const set: Record<string, unknown> = { ...rest };
      if (rest.purchaseDate !== undefined) set.purchaseDate = rest.purchaseDate === null ? null : new Date(rest.purchaseDate);
      if (rest.rentalRate !== undefined) set.rentalRate = rest.rentalRate === null ? null : rest.rentalRate.toString();
      if (rest.dailyRate !== undefined) set.dailyRate = rest.dailyRate === null ? null : rest.dailyRate.toString();
      await db.update(equipment).set({ ...set, updatedAt: new Date() })
        .where(and(eq(equipment.id, id), eq(equipment.companyId, companyId)));
      return { success: true };
    }),

  delete: companyScopedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await db.delete(equipment).where(and(eq(equipment.id, input.id), eq(equipment.companyId, input.companyId)));
      return { success: true };
    }),

  checkOut: companyScopedProcedure
    .input(z.object({
      companyId: z.number(), equipmentId: z.number(), projectId: z.number(),
      assignedTo: z.number().optional(), assignedBy: z.number(),
      expectedReturn: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const rows = await db.insert(equipmentAssignments).values({
        equipmentId: input.equipmentId, projectId: input.projectId,
        assignedTo: input.assignedTo, assignedBy: input.assignedBy,
        expectedReturn: input.expectedReturn ? new Date(input.expectedReturn) : undefined,
        notes: input.notes,
      }).returning();
      await db.update(equipment).set({ status: 'in_use' as any })
        .where(and(eq(equipment.id, input.equipmentId), eq(equipment.companyId, input.companyId)));
      return rows[0];
    }),

  checkIn: companyScopedProcedure
    .input(z.object({ assignmentId: z.number(), equipmentId: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await db.update(equipmentAssignments).set({ checkedIn: new Date() })
        .where(eq(equipmentAssignments.id, input.assignmentId));
      await db.update(equipment).set({ status: 'available' as any })
        .where(and(eq(equipment.id, input.equipmentId), eq(equipment.companyId, input.companyId)));
      return { success: true };
    }),

  assignments: companyScopedProcedure
    .input(z.object({ companyId: z.number(), equipmentId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(equipmentAssignments.projectId, input.companyId)];
      if (input.equipmentId) conditions.push(eq(equipmentAssignments.equipmentId, input.equipmentId));
      return db.select().from(equipmentAssignments)
        .where(and(...conditions))
        .orderBy(desc(equipmentAssignments.createdAt));
    }),
});
