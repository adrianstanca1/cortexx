import type { Request,Response } from 'express';
import { logger } from '../lib/logger';
export function errorHandler(err:unknown,_req:Request,res:Response) {
  const e = err as {message?:string;statusCode?:number;status?:number};
  logger.error('Unhandled',{msg:e.message});
  res.status(e.statusCode??e.status??500).json({
    success:false,
    error: process.env.NODE_ENV==='production'?'Internal error':e.message,
  });
}
