// =============================================================================
// CortexBuild Unified — All Routers
// =============================================================================
import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db.js";
import * as schema from "../schema.js";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { SignJWT } from "jose";
import { QuantumCollaborationSystem } from "../websocket/quantum-collaboration.js";

const collabSystem = new QuantumCollaborationSystem();

const jwtSecretRaw = process.env.JWT_SECRET;
if (!jwtSecretRaw || jwtSecretRaw.length < 32) {
  throw new Error(
    "JWT_SECRET must be set to a value of at least 32 characters before the server can start. " +
    "Set it in the environment (e.g. `.env` for dev, repo secrets for CI/deploy).",
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

const cIdWhere = (cId: number | null | undefined) => cId ? sql`company_id = ${cId}` : sql`1=1`;

// Reserved for future use — every router currently inlines pagination because
// Drizzle's `.offset().limit()` chain is clearer at the call site than this helper.
// Kept as an underscore-prefixed reference so ESLint stops flagging it.
function _paginate(_schemaName: string, page: number, perPage: number) {
  return sql`OFFSET ${(page - 1) * perPage} LIMIT ${perPage}`;
}

// ── AUTH
export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.select().from(schema.users).where(eq(schema.users.id, ctx.auth.userId)).limit(1);
    return { user: user[0] || null };
  }),
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const bcrypt = await import("bcryptjs");
      const user = (await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1))[0];
      if (!user || !user.passwordHash) throw new Error("Invalid credentials");
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new Error("Invalid credentials");
      const token = await new SignJWT({ sub: String(user.id), email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(JWT_SECRET);
      return { token, user };
    }),
  register: publicProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8), companyName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const bcrypt = await import("bcryptjs");
      const slug = input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [company] = await db.insert(schema.companies).values({ name: input.companyName, slug }).returning();
      const hash = await bcrypt.hash(input.password, 12);
      const [user] = await db.insert(schema.users).values({
        name: input.name, email: input.email, passwordHash: hash,
        role: "company_owner", companyId: company.id,
      }).returning();
      const token = await new SignJWT({ sub: String(user.id), email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(JWT_SECRET);
      return { token, user };
    }),
});

// ── DASHBOARD
export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const cId = ctx.auth?.companyId;
    const [proj] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM projects WHERE ${cIdWhere(cId)}`);
    const [tsk] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM tasks WHERE status != 'completed' AND ${cIdWhere(cId)}`);
    const [def] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM defects WHERE status = 'open' AND ${cIdWhere(cId)}`);
    const [inc] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM incidents WHERE status = 'open' AND ${cIdWhere(cId)}`);
    return {
      activeProjects: (proj as any)?.c ?? 0,
      openTasks: (tsk as any)?.c ?? 0,
      openDefects: (def as any)?.c ?? 0,
      openIncidents: (inc as any)?.c ?? 0,
      totalProjects: (proj as any)?.c ?? 0,
      pendingRfis: 0, pendingApprovals: 0, totalBudget: 0, totalSpent: 0,
      totalRevenue: 0, workersOnSite: 0, overdueItems: 0,
    };
  }),
});

// ── PROJECTS
export const projectRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      perPage: z.number().default(20),
      status: z.string().optional(),
      search: z.string().optional(),
    }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.projects.companyId, cId)] : [];
      if (input.status) conds.push(eq(schema.projects.status, input.status as any));
      const where = conds.length > 0 ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.projects).where(where || sql`true`))[0].c);
      const page = input.page || 1;
      const perPage = input.perPage || 20;
      const data = await db.select().from(schema.projects).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.projects.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return (await db.select().from(schema.projects).where(eq(schema.projects.id, input.id)).limit(1))[0] || null;
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      clientName: z.string().optional(),
      budget: z.string().optional(),
      siteAddress: z.string().optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
      contractType: z.string().optional(),
      geofenceRadius: z.number().default(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await db.insert(schema.projects).values({
        ...input,
        companyId: ctx.auth?.companyId || null,
        createdBy: ctx.auth.userId,
        siteLat: null, siteLng: null,
      }).returning();
      return p;
    }),
});

// ── TASKS
export const taskRouter = router({
  list: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      page: z.number().default(1),
      perPage: z.number().default(20),
      status: z.string().optional(),
      assignedToId: z.number().optional(),
    }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.tasks.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.tasks.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.tasks.status, input.status as any));
      if (input.assignedToId) conds.push(eq(schema.tasks.assignedToId, input.assignedToId));
      const where = conds.length > 0 ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.tasks).where(where || sql`true`))[0].c);
      const page = input.page || 1;
      const perPage = input.perPage || 20;
      const data = await db.select().from(schema.tasks).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.tasks.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  create: protectedProcedure
    .input(z.object({
      projectId: z.number(), title: z.string().min(1),
      priority: z.enum(["low","medium","high","critical"]).default("medium"),
      status: z.enum(["not_started","in_progress","completed","blocked","on_hold"]).default("not_started"),
      description: z.string().optional(),
      assignedToId: z.number().optional(), trade: z.string().optional(),
      dueDate: z.coerce.date().optional(), estimatedHours: z.string().optional(), parentTaskId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [t] = await db.insert(schema.tasks).values({
        ...input, companyId: ctx.auth?.companyId || null, createdBy: ctx.auth.userId,
      }).returning();
      return t;
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().optional(),
      status: z.enum(["not_started","in_progress","completed","blocked","on_hold"]).optional(),
      priority: z.enum(["low","medium","high","critical"]).optional(),
      assignedToId: z.number().optional().nullable(),
      progress: z.number().optional(), description: z.string().optional(),
      dueDate: z.coerce.date().optional(), completedAt: z.coerce.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const [t] = await db.update(schema.tasks).set({ ...rest, updatedAt: new Date() }).where(eq(schema.tasks.id, id)).returning();
      return t;
    }),
});

// ── DEFECTS
export const defectRouter = router({
  list: protectedProcedure.input(z.object({
    page: z.number().default(1), perPage: z.number().default(20),
    projectId: z.number().optional(), status: z.string().optional(),
  }).partial()).query(async ({ ctx, input }) => {
    const cId = ctx.auth?.companyId;
    const conds: any[] = cId ? [eq(schema.defects.companyId, cId)] : [];
    if (input.projectId) conds.push(eq(schema.defects.projectId, input.projectId));
    if (input.status) conds.push(eq(schema.defects.status, input.status));
    const where = conds.length ? and(...conds) : undefined;
    const total = Number((await db.select({ c: count() }).from(schema.defects).where(where || sql`true`))[0].c);
    const page = input.page || 1; const perPage = input.perPage || 20;
    const data = await db.select().from(schema.defects).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.defects.createdAt));
    return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.defects).where(eq(schema.defects.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional(), status: z.string().optional(), priority: z.string().optional(), type: z.string().optional() })
    .passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.defects).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── INSPECTIONS
export const inspectionRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.inspections.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.inspections.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.inspections.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.inspections).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.inspections).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.inspections.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.inspections).where(eq(schema.inspections.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional(), status: z.string().optional(), type: z.string().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.inspections).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── RFIs
export const rfiRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.rfis.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.rfis.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.rfis.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.rfis).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.rfis).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.rfis.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.rfis).where(eq(schema.rfis.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), question: z.string().optional(), projectId: z.number().optional(), status: z.string().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.rfis).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── INCIDENTS
export const incidentRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.incidents.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.incidents.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.incidents.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.incidents).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.incidents).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.incidents.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.incidents).where(eq(schema.incidents.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional(), severity: z.string().optional(), incidentType: z.string().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.incidents).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── PERMITS
export const permitRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.permits.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.permits.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.permits.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.permits).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.permits).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.permits.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.permits).where(eq(schema.permits.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional(), permitType: z.string().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.permits).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── DAILY REPORTS
export const dailyReportRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.dailyReports.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.dailyReports.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.dailyReports.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.dailyReports).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.dailyReports).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.dailyReports.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.dailyReports).where(eq(schema.dailyReports.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ reportDate: z.coerce.date(), description: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.dailyReports).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── TIMESHEETS
export const timesheetRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional(), userId: z.number().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.timesheets.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.timesheets.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.timesheets.status, input.status));
      if (input.userId) conds.push(eq(schema.timesheets.userId, input.userId));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.timesheets).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.timesheets).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.timesheets.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.timesheets).where(eq(schema.timesheets.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ date: z.coerce.date(), hoursWorked: z.string(), projectId: z.number().optional(), userId: z.number() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.timesheets).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── INVOICES
export const invoiceRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.invoices.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.invoices.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.invoices.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.invoices).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.invoices).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.invoices.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.invoices).where(eq(schema.invoices.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ invoiceNumber: z.string().min(1), description: z.string().optional(), amount: z.string().optional(), projectId: z.number().optional(), clientId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.invoices).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── MATERIALS
export const materialRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.materials.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.materials.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.materials.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.materials).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.materials).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.materials.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.materials).where(eq(schema.materials.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), description: z.string().optional(), quantity: z.string().optional(), unit: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.materials).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── EQUIPMENT
export const equipmentRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.equipment.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.equipment.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.equipment.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.equipment).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.equipment).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.equipment.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.equipment).where(eq(schema.equipment.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), description: z.string().optional(), serialNumber: z.string().optional(), manufacturer: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.equipment).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── DRAWINGS
export const drawingRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.drawings.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.drawings.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.drawings.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.drawings).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.drawings).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.drawings.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.drawings).where(eq(schema.drawings.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), fileUrl: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.drawings).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── MEETINGS
export const meetingRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.meetings.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.meetings.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.meetings.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.meetings).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.meetings).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.meetings.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.meetings).where(eq(schema.meetings.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), location: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.meetings).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── BUDGETS
export const budgetRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.budgets.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.budgets.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.budgets.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.budgets).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.budgets).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.budgets.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.budgets).where(eq(schema.budgets.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ category: z.string().min(1), description: z.string().optional(), budgetedAmount: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.budgets).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── CHANGE ORDERS
export const changeOrderRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.changeOrders.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.changeOrders.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.changeOrders.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.changeOrders).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.changeOrders).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.changeOrders.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.changeOrders).where(eq(schema.changeOrders.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ coNumber: z.string().min(1), title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.changeOrders).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── SUBMITTALS
export const submittalRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.submittals.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.submittals.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.submittals.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.submittals).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.submittals).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.submittals.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.submittals).where(eq(schema.submittals.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ submittalNumber: z.string().min(1), title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.submittals).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── PURCHASE ORDERS
export const purchaseOrderRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.purchaseOrders.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.purchaseOrders.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.purchaseOrders.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.purchaseOrders).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.purchaseOrders).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.purchaseOrders.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ poNumber: z.string().min(1), description: z.string().optional(), amount: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.purchaseOrders).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── PUNCH ITEMS
export const punchItemRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.punchItems.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.punchItems.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.punchItems.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.punchItems).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.punchItems).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.punchItems.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.punchItems).where(eq(schema.punchItems.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ number: z.string().min(1), title: z.string().min(1), description: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.punchItems).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── TENDERS
export const tenderRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.tenders.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.tenders.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.tenders.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.tenders).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.tenders).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.tenders.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.tenders).where(eq(schema.tenders.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), budget: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.tenders).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── RISK REGISTER
export const riskRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.riskRegister.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.riskRegister.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.riskRegister.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.riskRegister).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.riskRegister).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.riskRegister.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.riskRegister).where(eq(schema.riskRegister.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional(), category: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.riskRegister).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── CERTIFICATIONS
export const certificationRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), userId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ input }) => {
      const page = input.page || 1; const perPage = input.perPage || 20;
      const conds: any[] = [];
      if (input.userId) conds.push(eq(schema.certifications.userId, input.userId));
      if (input.status) conds.push(eq(schema.certifications.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.certifications).where(where || sql`true`))[0].c);
      const data = await db.select().from(schema.certifications).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.certifications.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.certifications).where(eq(schema.certifications.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), issuingBody: z.string().optional(), userId: z.number().optional() }).passthrough()).mutation(async ({ input }) => {
    const [item] = await db.insert(schema.certifications).values({ ...input } as any).returning();
    return item;
  }),
});

// ── CHECK-INS
export const checkInRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), userId: z.number().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.checkIns.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.checkIns.projectId, input.projectId));
      if (input.userId) conds.push(eq(schema.checkIns.userId, input.userId));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.checkIns).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.checkIns).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.checkIns.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.checkIns).where(eq(schema.checkIns.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ userId: z.number(), projectId: z.number().optional(), type: z.string().optional(), latitude: z.string().optional(), longitude: z.string().optional(), notes: z.string().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.checkIns).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── FILES
export const fileRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), fileType: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.files.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.files.projectId, input.projectId));
      if (input.fileType) conds.push(eq(schema.files.fileType, input.fileType));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.files).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.files).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.files.uploadedAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.files).where(eq(schema.files.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), url: z.string().min(1), mimeType: z.string().optional(), size: z.number().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.files).values({ ...input, companyId: ctx.auth?.companyId || null, uploadedBy: ctx.auth.userId } as any).returning();
    return item;
  }),
});

// ── NOTIFICATIONS
export const notificationRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20) }).partial())
    .query(async ({ ctx, input }) => {
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.notifications)
        .where(eq(schema.notifications.userId, ctx.auth.userId))
        .limit(perPage).offset((page - 1) * perPage)
        .orderBy(desc(schema.notifications.createdAt));
      return { data, pagination: { page, perPage, total: data.length, totalPages: 1 } };
    }),
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db.select({ c: count() }).from(schema.notifications)
      .where(and(eq(schema.notifications.userId, ctx.auth.userId), eq(schema.notifications.read, false)));
    return Number(row.c);
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.update(schema.notifications).set({ read: true, readAt: new Date() }).where(eq(schema.notifications.id, input.id));
  }),
});

// ── AI CONVERSATIONS
export const aiRouter = router({
  conversation: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return (await db.select().from(schema.aiConversations).where(eq(schema.aiConversations.id, input.id)).limit(1))[0] || null;
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(schema.aiConversations)
      .where(eq(schema.aiConversations.userId, ctx.auth.userId))
      .orderBy(desc(schema.aiConversations.createdAt));
  }),
  sendMessage: protectedProcedure.input(z.object({
    conversationId: z.number(), message: z.string().min(1),
    projectId: z.number().optional(), agentType: z.string().optional(),
  })).mutation(async () => {
    return { message: "AI response placeholder", streaming: false };
  }),
});

// ── COMPANY
export const companyRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.companyId) return null;
    return (await db.select().from(schema.companies).where(eq(schema.companies.id, ctx.auth.companyId)).limit(1))[0] || null;
  }),
  update: adminProcedure.input(z.record(z.unknown())).mutation(async ({ ctx, input }) => {
    if (!ctx.auth.companyId) throw new Error("No company");
    const [c] = await db.update(schema.companies).set({ ...(input as any), updatedAt: new Date() }).where(eq(schema.companies.id, ctx.auth.companyId)).returning();
    return c;
  }),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), address: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), vatNumber: z.string().optional(), website: z.string().optional(), domain: z.string().optional() }).passthrough()).mutation(async ({ input }) => {
    const slug = (input.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [c] = await db.insert(schema.companies).values({ ...input, slug } as any).returning();
    return c;
  }),
});

// ── SETTINGS
export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = (await db.select().from(schema.users).where(eq(schema.users.id, ctx.auth.userId)).limit(1))[0];
    return { user };
  }),
  updateProfile: protectedProcedure.input(z.object({
    name: z.string().optional(), phone: z.string().optional(),
    jobTitle: z.string().optional(), department: z.string().optional(),
    trade: z.string().optional(), avatarUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [u] = await db.update(schema.users).set({ ...input, updatedAt: new Date() }).where(eq(schema.users.id, ctx.auth.userId)).returning();
    return u;
  }),
  updatePreferences: protectedProcedure.input(z.object({
    pushPreferences: z.record(z.boolean()).optional(),
    emailPreferences: z.record(z.boolean()).optional(),
    uiPreferences: z.record(z.unknown()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const [u] = await db.update(schema.users).set({ ...input, updatedAt: new Date() }).where(eq(schema.users.id, ctx.auth.userId)).returning();
    return u;
  }),
});

// ── BILLING
export const billingRouter = router({
  getPlan: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.companyId) return null;
    return (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, ctx.auth.companyId)).limit(1))[0] || null;
  }),
});

// ── REPORTS
export const reportRouter = router({
  list: protectedProcedure.query(() => ([])),
});

// ── BIM
export const bimRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => {
    return db.select().from(schema.bimModels).where(eq(schema.bimModels.projectId, input.projectId));
  }),
});

// ── MAP
export const mapRouter = router({
  projectSites: protectedProcedure.query(async ({ ctx }) => {
    const cId = ctx.auth?.companyId;
    return db.select({ id: schema.projects.id, name: schema.projects.name, siteLat: schema.projects.siteLat, siteLng: schema.projects.siteLng, status: schema.projects.status })
      .from(schema.projects)
      .where(cId ? and(eq(schema.projects.companyId, cId), sql`${schema.projects.siteLat} IS NOT NULL`) : sql`${schema.projects.siteLat} IS NOT NULL`);
  }),
});

// ── WEATHER
export const weatherRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.number(), days: z.number().default(7) })).query(async ({ input }) => {
    return db.select().from(schema.weatherLogs).where(eq(schema.weatherLogs.projectId, input.projectId)).orderBy(desc(schema.weatherLogs.date)).limit(input.days);
  }),
});

// ── ACTIVITY FEED
export const activityRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20) }).partial())
    .query(async ({ ctx, input }) => {
      const page = input.page || 1; const perPage = input.perPage || 20;
      const conds: any[] = [];
      if (ctx.auth?.companyId) conds.push(eq(schema.activityFeed.companyId, ctx.auth.companyId));
      const where = conds.length ? and(...conds) : undefined;
      return db.select().from(schema.activityFeed).where(where || sql`true`).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.activityFeed.createdAt));
    }),
});

// ── DOCUMENTS
export const documentRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.documents.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.documents.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.documents.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.documents).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.documents).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.documents.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.documents).where(eq(schema.documents.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), description: z.string().optional(), type: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.documents).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── DELAY NOTES
export const delayNoteRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional(), status: z.string().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.delayNotes.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.delayNotes.projectId, input.projectId));
      if (input.status) conds.push(eq(schema.delayNotes.status, input.status));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.delayNotes).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.delayNotes).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.delayNotes.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.delayNotes).where(eq(schema.delayNotes.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ title: z.string().min(1), reason: z.string().optional(), description: z.string().optional(), impactDays: z.number().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.delayNotes).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── COST FORECASTS
export const costForecastRouter = router({
  list: protectedProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(20), projectId: z.number().optional() }).partial())
    .query(async ({ ctx, input }) => {
      const cId = ctx.auth?.companyId;
      const conds: any[] = cId ? [eq(schema.costForecasts.companyId, cId)] : [];
      if (input.projectId) conds.push(eq(schema.costForecasts.projectId, input.projectId));
      const where = conds.length ? and(...conds) : undefined;
      const total = Number((await db.select({ c: count() }).from(schema.costForecasts).where(where || sql`true`))[0].c);
      const page = input.page || 1; const perPage = input.perPage || 20;
      const data = await db.select().from(schema.costForecasts).where(where).limit(perPage).offset((page - 1) * perPage).orderBy(desc(schema.costForecasts.createdAt));
      return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => (await db.select().from(schema.costForecasts).where(eq(schema.costForecasts.id, input.id)).limit(1))[0] || null),
  create: protectedProcedure.input(z.object({ month: z.number(), year: z.number(), budget: z.string().optional(), actual: z.string().optional(), forecast: z.string().optional(), projectId: z.number().optional() }).passthrough()).mutation(async ({ ctx, input }) => {
    const [item] = await db.insert(schema.costForecasts).values({ ...input, companyId: ctx.auth?.companyId || null } as any).returning();
    return item;
  }),
});

// ── TEAM
export const teamRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const cId = ctx.auth?.companyId;
    if (!cId) return [];
    const mems = await db.select().from(schema.companyUsers).where(eq(schema.companyUsers.companyId, cId));
    const usersData = await db.select().from(schema.users);
    return mems.map(m => ({
      ...m,
      user: usersData.find(u => u.id === (m as any).userId) || null,
    }));
  }),
});

// ── QUANTUM COLLABORATION
export const collaborationRouter = router({
  sessions: protectedProcedure.query(async () => {
    const status = collabSystem.getSystemStatus();
    return status.sessions;
  }),
  sessionById: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = collabSystem.getSession(input.sessionId);
      if (!session) throw new Error('Session not found');
      return session;
    }),
  joinSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { participant, session } = collabSystem.joinSession(input.sessionId, input.name);
      return { participant, session: { id: session.id, name: session.name, participants: session.participants.length } };
    }),
  leaveSession: protectedProcedure
    .input(z.object({ participantId: z.string() }))
    .mutation(async ({ input }) => {
      collabSystem.leaveSession(input.participantId);
      return { success: true };
    }),
  sendMessage: protectedProcedure
    .input(z.object({ participantId: z.string(), sessionId: z.string().min(1), content: z.string().min(1) }))
    .mutation(async ({ input }) => {
      collabSystem.processMessage(input.participantId, {
        type: 'text_message',
        sessionId: input.sessionId,
        content: input.content,
      });
      return { success: true };
    }),
  messages: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return collabSystem.getMessages(input.sessionId);
    }),
  analytics: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return collabSystem.getAnalytics(input.sessionId);
    }),
});
// Keys are the client-facing namespaces (camelCase, plural where the
// resource is a collection). When adding a new domain router above,
// also wire it here or it stays unreachable.
export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  projects: projectRouter,
  tasks: taskRouter,
  defects: defectRouter,
  inspections: inspectionRouter,
  rfis: rfiRouter,
  incidents: incidentRouter,
  permits: permitRouter,
  dailyReports: dailyReportRouter,
  timesheets: timesheetRouter,
  invoices: invoiceRouter,
  materials: materialRouter,
  equipment: equipmentRouter,
  drawings: drawingRouter,
  meetings: meetingRouter,
  budgets: budgetRouter,
  changeOrders: changeOrderRouter,
  submittals: submittalRouter,
  purchaseOrders: purchaseOrderRouter,
  punchItems: punchItemRouter,
  tenders: tenderRouter,
  risks: riskRouter,
  certifications: certificationRouter,
  checkIns: checkInRouter,
  files: fileRouter,
  notifications: notificationRouter,
  ai: aiRouter,
  companies: companyRouter,
  settings: settingsRouter,
  billing: billingRouter,
  reports: reportRouter,
  bim: bimRouter,
  map: mapRouter,
  weather: weatherRouter,
  activity: activityRouter,
  documents: documentRouter,
  delayNotes: delayNoteRouter,
  costForecast: costForecastRouter,
  team: teamRouter,
  collaboration: collaborationRouter,
});

export type AppRouter = typeof appRouter;
