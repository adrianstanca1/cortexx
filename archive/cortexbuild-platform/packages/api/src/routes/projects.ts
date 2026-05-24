import { Router } from 'express';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { db, projects, tasks, safetyIncidents, projectWorkers } from '@cortexbuild/db';
import { createProjectSchema } from '@cortexbuild/shared';

import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { broadcast } from '../websocket';

const router: Router = Router();

router.use(authMiddleware);

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const companyId = req.user!.companyId!;

  const cond = and(eq(projects.companyId, companyId), search ? ilike(projects.name, `%${search}%`) : undefined);
  const rows = await db.select().from(projects).where(cond).orderBy(desc(projects.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(projects).where(cond);
  res.json(paginatedResp(rows,page,limit,value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(projects).where(and(eq(projects.id,id),eq(projects.companyId,req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.get('/:id/stats', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const cid = req.user!.companyId!;
  const [taskCount] = await db.select({value:count()}).from(tasks).where(and(eq(tasks.projectId,id),eq(tasks.companyId,cid)));
  const [completedTasks] = await db.select({value:count()}).from(tasks).where(and(eq(tasks.projectId,id),eq(tasks.companyId,cid),eq(tasks.status,'completed')));
  const [openIncidents] = await db.select({value:count()}).from(safetyIncidents).where(and(eq(safetyIncidents.projectId,id),eq(safetyIncidents.companyId,cid),eq(safetyIncidents.status,'open')));
  const [members] = await db.select({value:count()}).from(projectWorkers).where(eq(projectWorkers.projectId,id));
  res.json({success:true,data:{tasks:taskCount.value,completed:completedTasks.value,incidents:openIncidents.value,team:members.value}});
});

// Helper: broadcast project events to the company room. The websocket
// module defines broadcast(room, msg) but had zero call-sites before
// this commit — same gap buildtrack-api had until commit c3b894c.
function emitProject(verb: 'created' | 'updated' | 'deleted', row: unknown, companyId: number) {
  if (!row) return;
  try {
    broadcast(`company:${companyId}`, {
      type: `project-${verb}`,
      project: row,
      at: new Date().toISOString(),
    });
  } catch { /* best-effort */ }
}

router.post('/', validateBody(createProjectSchema), async (req:AuthRequest,res) => {
  const companyId = req.user!.companyId!;
  const data = { ...req.body, companyId, createdBy: req.user!.id };
  const [row] = await db.insert(projects).values(data).returning();
  emitProject('created', row, companyId);
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(createProjectSchema.partial()), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const companyId = req.user!.companyId!;
  const [row] = await db.update(projects).set({...req.body,updatedAt:new Date()}).where(
    and(eq(projects.id,id),eq(projects.companyId,companyId))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  emitProject('updated', row, companyId);
  res.json({success:true,data:row});
});

router.delete('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const companyId = req.user!.companyId!;
  // Read the row before delete so the broadcast can carry its identity.
  const [existing] = await db.select().from(projects).where(and(eq(projects.id,id),eq(projects.companyId,companyId))).limit(1);
  await db.delete(projects).where(and(eq(projects.id,id),eq(projects.companyId,companyId)));
  if (existing) emitProject('deleted', existing, companyId);
  res.json({success:true});
});

export default router;
