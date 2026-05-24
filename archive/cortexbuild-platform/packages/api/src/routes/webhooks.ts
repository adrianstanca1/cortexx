import { Router } from 'express';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { db, webhooks } from '@cortexbuild/db';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

// Webhooks ship secrets and target arbitrary URLs. Per MODULE_ACL.integrations,
// all mutations require 'company_admin' / 'super_admin'. Reads stay open so
// non-admin users can see what's wired without being able to add/edit/remove.
const requireIntegrationsAdmin = requireRole('admin', 'company_admin', 'company_owner', 'super_admin');

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(webhooks.companyId, cid), search ? ilike(webhooks.name, `%${search}%`) : undefined);
  const rows = await db.select().from(webhooks).where(cond).orderBy(desc(webhooks.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(webhooks).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(webhooks).where(
    and(eq(webhooks.id, id), eq(webhooks.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', requireIntegrationsAdmin, validateBody(z.any()), async (req:AuthRequest,res) => {
  const [row] = await db.insert(webhooks).values({...req.body, companyId: req.user!.companyId!}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', requireIntegrationsAdmin, validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(webhooks).set({...req.body,updatedAt:new Date()}).where(
    and(eq(webhooks.id, id), eq(webhooks.companyId, req.user!.companyId!))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', requireIntegrationsAdmin, async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.companyId, req.user!.companyId!)));
  res.json({success:true});
});

export default router;
