import { Router } from 'express';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { db, tasks } from '@cortexbuild/db';
import { z } from 'zod';
import { createTaskSchema } from '@cortexbuild/shared';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { broadcast } from '../websocket';

const router: Router = Router();
router.use(authMiddleware);

// Helper: broadcast task events to the project room of the row (so
// dashboards filtered to a project see live updates) AND to the
// company-wide room (so the global task list sees them too).
function emitTask(verb: 'created' | 'updated' | 'deleted', row: unknown, companyId: number) {
  if (!row) return;
  try {
    const msg = { type: `task-${verb}`, task: row, at: new Date().toISOString() };
    if ((row as Record<string, unknown>).projectId) broadcast(`project:${(row as Record<string, unknown>).projectId}`, msg);
    broadcast(`company:${companyId}`, msg);
  } catch { /* best-effort */ }
}

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(tasks.companyId, cid), search ? ilike(tasks.title, `%${search}%`) : undefined);
  const rows = await db.select().from(tasks).where(cond).orderBy(desc(tasks.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(tasks).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(tasks).where(
    and(eq(tasks.id, id), eq(tasks.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', validateBody(createTaskSchema), async (req:AuthRequest,res) => {
  const companyId = req.user!.companyId!;
  const [row] = await db.insert(tasks).values({...req.body, companyId}).returning();
  emitTask('created', row, companyId);
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const companyId = req.user!.companyId!;
  const [row] = await db.update(tasks).set({...req.body,updatedAt:new Date()}).where(
    and(eq(tasks.id, id), eq(tasks.companyId, companyId))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  emitTask('updated', row, companyId);
  res.json({success:true,data:row});
});

router.delete('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const companyId = req.user!.companyId!;
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, companyId))).limit(1);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, companyId)));
  if (existing) emitTask('deleted', existing, companyId);
  res.json({success:true});
});

export default router;
