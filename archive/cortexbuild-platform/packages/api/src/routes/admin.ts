import { Router } from 'express';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { db, users } from '@cortexbuild/db';
import { z } from 'zod';
import { createUserSchema } from '@cortexbuild/shared';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

// Admin routes manage the `users` table for the caller's tenant — creating,
// editing or deleting other users. Per MODULE_ACL.team, create/edit require
// 'admin' and delete requires 'company_owner'. Read endpoints (list + by-id)
// are left open to any authenticated user in the company since the UI uses
// them to populate assignee pickers and member directories.
const requireAdmin = requireRole('admin', 'company_owner', 'super_admin');
const requireOwner = requireRole('company_owner', 'super_admin');

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(users.companyId, cid), search ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)) : undefined);
  const rows = await db.select().from(users).where(cond).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(users).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(users).where(
    and(eq(users.id, id), eq(users.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', requireAdmin, validateBody(createUserSchema), async (req:AuthRequest,res) => {
  const [row] = await db.insert(users).values({...req.body, companyId: req.user!.companyId!}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', requireAdmin, validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(users).set({...req.body,updatedAt:new Date()}).where(
    and(eq(users.id, id), eq(users.companyId, req.user!.companyId!))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', requireOwner, async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(users).where(and(eq(users.id, id), eq(users.companyId, req.user!.companyId!)));
  res.json({success:true});
});

export default router;
