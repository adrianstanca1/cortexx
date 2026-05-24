import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { db } from '@cortexbuild/db';
import { sql } from 'drizzle-orm';
import { setupRoutes } from './routes/index';
import { setupWebSocket } from './websocket';
import { scheduler } from './scheduler';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error';

const app = express();
const server = createServer(app);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true }));
app.use(compression());
app.use(morgan('combined',
  { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

app.get('/health', async (_req, res) => {
  try { await db.execute(sql`SELECT 1`);
    res.json({ status: 'ok', version: '2.0.0', service:'cortexbuild-api',
      timestamp: new Date().toISOString() });
  } catch { res.status(503).json({ status: 'error', service:'cortexbuild-api' }); }
});

app.get('/api/health', async (_req, res) => {
  const pgOk = await db.execute(sql`SELECT 1`).then(()=>true).catch(()=>false);
  res.json({ status: pgOk ? 'ok' : 'degraded', version:'2.0.0',
    service:'cortexbuild-api', postgres: pgOk,
    timestamp: new Date().toISOString() });
});

setupRoutes(app);
app.use(errorHandler);

const wss = new WebSocketServer({ server, path: '/ws' });
setupWebSocket(wss);

scheduler.start();

const PORT = parseInt(process.env.PORT ?? '3001', 10);
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 CortexBuild API v2.0.0 on port ${PORT}`);
  logger.info(`📡 WebSocket: ws://0.0.0.0:${PORT}/ws`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received'); server.close(() => process.exit(0));
});
