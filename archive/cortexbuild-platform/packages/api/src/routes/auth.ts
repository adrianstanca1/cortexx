import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, users, sessions, companies, companyMembers } from '@cortexbuild/db';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh';
const JWT_EXPIRY = '24h';
const REFRESH_EXPIRY = '7d';

export function signToken(userId:number,sessionId?:string) {
  return jwt.sign({userId,sessionId},JWT_SECRET,{expiresIn:JWT_EXPIRY});
}
export function signRefresh(userId:number) {
  return jwt.sign({userId},JWT_REFRESH,{expiresIn:REFRESH_EXPIRY});
}

const loginSchema = z.object({ email:z.string().email(), password:z.string().min(1) });
const registerSchema = z.object({
  name:z.string().min(2).max(255),
  email:z.string().email(),
  password:z.string().min(8),
  companyName:z.string().min(2).max(255).optional(),
  role:z.string().optional(),
});

router.post('/register', validateBody(registerSchema), async (req,res) => {
  const { name, email, password, companyName } = req.body;
  const existing = await db.select().from(users).where(eq(users.email,email)).limit(1);
  if (existing.length) { res.status(409).json({success:false,error:'Email in use'}); return; }

  let companyId:number|undefined;
  if (companyName) {
    const [c] = await db.insert(companies).values({ name:companyName, slug:companyName.toLowerCase().replace(/\s+/g,'-').slice(0,255) }).returning();
    companyId = c.id;
  }

  const hash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({
    name, email, passwordHash:hash, role:'company_owner', companyId,
    openId: email, loginMethod: 'password',
  }).returning();

  if (companyId) {
    await db.insert(companyMembers).values({ companyId, userId:user.id, role:'company_owner' });
  }

  const token = signToken(user.id);
  const refresh = signRefresh(user.id);
  res.status(201).json({success:true,data:{token,refresh,user:{id:user.id,name:user.name,email:user.email,role:user.role,companyId:user.companyId}}});
});

router.post('/login', validateBody(loginSchema), async (req,res) => {
  const { email, password } = req.body;
  const u = await db.select().from(users).where(eq(users.email,email)).limit(1);
  if (!u.length || !u[0].passwordHash) { res.status(401).json({success:false,error:'Invalid credentials'}); return; }
  const ok = await bcrypt.compare(password, u[0].passwordHash);
  if (!ok) { res.status(401).json({success:false,error:'Invalid credentials'}); return; }

  const expires = new Date(Date.now()+7*24*60*60*1000);
  const [sess] = await db.insert(sessions).values({ id: crypto.randomUUID(), userId:u[0].id, companyId:u[0].companyId, expiresAt:expires }).returning();
  await db.update(users).set({lastSignedIn:new Date()}).where(eq(users.id,u[0].id));

  const token = signToken(u[0].id, sess.id);
  res.json({success:true,data:{token,user:{id:u[0].id,name:u[0].name,email:u[0].email,role:u[0].role,companyId:u[0].companyId}}});
});

router.post('/refresh', async (req,res) => {
  const refresh = req.body.refresh ?? req.cookies?.refresh;
  if (!refresh) { res.status(401).json({success:false,error:'Required'}); return; }
  try {
    const dec = jwt.verify(refresh,JWT_REFRESH) as {userId:number};
    const u = await db.select().from(users).where(eq(users.id,dec.userId)).limit(1);
    if (!u.length) { res.status(401).json({success:false,error:'Not found'}); return; }
    const token = signToken(u[0].id);
    res.json({success:true,data:{token}});
  } catch { res.status(401).json({success:false,error:'Invalid'}); }
});

router.get('/me', authMiddleware, async (req:AuthRequest,res) => {
  if (!req.user) { res.status(401).json({success:false,error:'Required'}); return; }
  await db.update(users).set({lastSignedIn:new Date()}).where(eq(users.id,req.user.id));
  res.json({success:true,data:req.user});
});

router.post('/change-password', authMiddleware, async (req:AuthRequest,res) => {
  const {currentPassword,newPassword} = req.body;
  const [u] = await db.select().from(users).where(eq(users.id,req.user!.id)).limit(1);
  if (!u?.passwordHash || !await bcrypt.compare(currentPassword,u.passwordHash)) {
    res.status(403).json({success:false,error:'Current incorrect'}); return;
  }
  await db.update(users).set({passwordHash:await bcrypt.hash(newPassword,12)}).where(eq(users.id,u.id));
  res.json({success:true});
});

export default router;
