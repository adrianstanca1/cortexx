import { Router } from 'express';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { db, notifications } from '@cortexbuild/db';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { paginate, paginatedResp } from '../lib/pagination';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();
router.use(authMiddleware);

router.get('/', async (req:AuthRequest,res) => {
  const { page, limit, offset } = paginate(req.query as Record<string, string | undefined>);
  const search = (Array.isArray(req.query.search) ? req.query.search[0] : req.query.search) ?? '';
  const uid = req.user!.id;
  const cond = and(eq(notifications.userId, uid), search ? ilike(notifications.title, `%${search}%`) : undefined);
  const rows = await db.select().from(notifications).where(cond).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset);
  const [{value}] = await db.select({value:count()}).from(notifications).where(cond);
  res.json(paginatedResp(rows, page, limit, value));
});

router.get('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select().from(notifications).where(
    and(eq(notifications.id, id), eq(notifications.userId, req.user!.id))).limit(1);
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.post('/', validateBody(z.any()), async (req:AuthRequest,res) => {
  const [row] = await db.insert(notifications).values({...req.body, userId: req.user!.id}).returning();
  res.status(201).json({success:true,data:row});
});

router.put('/:id', validateBody(z.record(z.any())), async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(notifications).set({...req.body,updatedAt:new Date()}).where(
    and(eq(notifications.id, id), eq(notifications.userId, req.user!.id))).returning();
  if (!row) { res.status(404).json({success:false,error:'Not found'}); return; }
  res.json({success:true,data:row});
});

router.delete('/:id', async (req:AuthRequest,res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
  res.json({success:true});
});

export default router;
