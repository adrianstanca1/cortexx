import { Router } from 'express';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { db, timesheets } from '@cortexbuild/db';
import { z } from 'zod';
import { createTimesheetSchema } from '@cortexbuild/shared';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

// Approved timesheets feed payroll; deletion has audit/compliance impact.
// Restrict DELETE to managers and above; create/update still open to workers
// so they can record their own hours.
const requireTimesheetAdmin = requireRole('manager', 'admin', 'company_owner', 'super_admin');

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(timesheets.companyId, cid), search ? or(ilike(timesheets.notes, `%${search}%`), ilike(timesheets.costCode, `%${search}%`)) : undefined);
  const rows = await db.select().from(timesheets).where(cond).orderBy(desc(timesheets.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(timesheets).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(timesheets).where(
    and(eq(timesheets.id, id), eq(timesheets.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', validateBody(createTimesheetSchema), async (req:AuthRequest,res) => {
  const [row] = await db.insert(timesheets).values({...req.body, companyId: req.user!.companyId!}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(timesheets).set({...req.body,updatedAt:new Date()}).where(
    and(eq(timesheets.id, id), eq(timesheets.companyId, req.user!.companyId!))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', requireTimesheetAdmin, async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(timesheets).where(and(eq(timesheets.id, id), eq(timesheets.companyId, req.user!.companyId!)));
  res.json({success:true});
});

export default router;
