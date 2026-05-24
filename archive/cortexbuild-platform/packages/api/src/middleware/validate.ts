import type { Request,Response,NextFunction } from 'express';
import { ZodSchema } from 'zod';
export function validateBody(s:ZodSchema) {
  return (req:Request,res:Response,next:NextFunction) => {
    const r = s.safeParse(req.body);
    if (!r.success) { res.status(400).json({success:false,error:'Validation',details:r.error.issues}); return; }
    req.body = r.data; next();
  };
}
export function validateQuery(s:ZodSchema) {
  return (req:Request,res:Response,next:NextFunction) => {
    const r = s.safeParse(req.query);
    if (!r.success) { res.status(400).json({success:false,error:'Invalid query'}); return; }
    req.query = r.data; next();
  };
}
