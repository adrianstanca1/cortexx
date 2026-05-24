import { Router } from 'express';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { db, safetyIncidents } from '@cortexbuild/db';
import { z } from 'zod';
import { createIncidentSchema } from '@cortexbuild/shared';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

// Safety incident records are a compliance artefact (HSE / SMSTS audit
// trail) and must not be removable by ordinary field workers. Per
// MODULE_ACL.safety, delete requires 'project_manager' minimum.
const requireSafetyAdmin = requireRole('project_manager', 'manager', 'admin', 'company_owner', 'super_admin');

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(safetyIncidents.companyId, cid), search ? ilike(safetyIncidents.title, `%${search}%`) : undefined);
  const rows = await db.select().from(safetyIncidents).where(cond).orderBy(desc(safetyIncidents.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(safetyIncidents).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(safetyIncidents).where(
    and(eq(safetyIncidents.id, id), eq(safetyIncidents.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', validateBody(createIncidentSchema), async (req:AuthRequest,res) => {
  const [row] = await db.insert(safetyIncidents).values({...req.body, companyId: req.user!.companyId!}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(safetyIncidents).set({...req.body,updatedAt:new Date()}).where(
    and(eq(safetyIncidents.id, id), eq(safetyIncidents.companyId, req.user!.companyId!))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', requireSafetyAdmin, async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(safetyIncidents).where(and(eq(safetyIncidents.id, id), eq(safetyIncidents.companyId, req.user!.companyId!)));
  res.json({success:true});
});

export default router;
