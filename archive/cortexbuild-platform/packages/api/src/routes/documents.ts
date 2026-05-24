import { Router } from 'express';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { db, documents } from '@cortexbuild/db';
import { z } from 'zod';
import { createDocumentSchema } from '@cortexbuild/shared';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const cid = req.user!.companyId!;
  const cond = and(eq(documents.companyId, cid), search ? ilike(documents.name, `%${search}%`) : undefined);
  const rows = await db.select().from(documents).where(cond).orderBy(desc(documents.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(documents).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(documents).where(
    and(eq(documents.id, id), eq(documents.companyId, req.user!.companyId!))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', validateBody(createDocumentSchema), async (req:AuthRequest,res) => {
  const [row] = await db.insert(documents).values({...req.body, companyId: req.user!.companyId!}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(documents).set({...req.body,updatedAt:new Date()}).where(
    and(eq(documents.id, id), eq(documents.companyId, req.user!.companyId!))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.companyId, req.user!.companyId!)));
  res.json({success:true});
});

export default router;
