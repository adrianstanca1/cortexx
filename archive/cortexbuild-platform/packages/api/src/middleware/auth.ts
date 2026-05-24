import type { Request,Response,NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, users } from '@cortexbuild/db';
import { logger } from '../lib/logger';

export interface AuthRequest extends Request {
  user?: { id:number; email:string; name:string|null; role:string; companyId?:number|null };
  token?: string;
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export async function authMiddleware(req:AuthRequest,res:Response,next:NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') ?? req.cookies?.token;
    if (!token) { res.status(401).json({error:'Required'}); return; }
    const decoded = jwt.verify(token,JWT_SECRET,{clockTolerance:30}) as {userId:number};
    const u = await db.select({id:users.id,email:users.email,name:users.name,role:users.role,companyId:users.companyId})
      .from(users).where(eq(users.id,decoded.userId)).limit(1);
    if (!u.length) { res.status(401).json({error:'Not found'}); return; }
    [req.user, req.token] = [u[0], token];
    next();
  } catch (err) { logger.warn('Auth fail', {msg:(err as Error).message});
    res.status(401).json({error:'Invalid token'}); }
}

export function requireRole(...roles:string[]) {
  return (req:AuthRequest,res:Response,next:NextFunction) => {
    if (!req.user) { res.status(401).json({error:'Required'}); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({error:'Forbidden'}); return; }
    next();
  };
}
