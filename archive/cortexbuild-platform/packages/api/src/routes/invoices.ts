import { Router } from 'express';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { db, invoices } from '@cortexbuild/db';
import { z } from 'zod';
import { createInvoiceSchema } from '@cortexbuild/shared';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

// MODULE_ACL.billing requires 'super_admin' for delete. In practice the
// available roles in this codebase are admin / company_owner / super_admin
// for destructive financial actions.
const requireBillingAdmin = requireRole('admin', 'company_owner', 'super_admin');

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(invoices.companyId, cid), search ? or(ilike(invoices.number, `%${search}%`), ilike(invoices.description, `%${search}%`)) : undefined);
  const rows = await db.select().from(invoices).where(cond).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(invoices).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(invoices).where(
    and(eq(invoices.id, id), eq(invoices.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', validateBody(createInvoiceSchema), async (req:AuthRequest,res) => {
  const [row] = await db.insert(invoices).values({...req.body, companyId: req.user!.companyId!}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(invoices).set({...req.body,updatedAt:new Date()}).where(
    and(eq(invoices.id, id), eq(invoices.companyId, req.user!.companyId!))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', requireBillingAdmin, async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, req.user!.companyId!)));
  res.json({success:true});
});

export default router;
