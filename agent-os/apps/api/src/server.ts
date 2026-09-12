import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Orchestrator } from '../../../packages/core/src/orchestrator.js';

const orchestrator = new Orchestrator();
const port = Number(process.env.PORT || 8787);
const webRoot = process.env.WEB_ROOT || join(process.cwd(), 'apps/web');

function send(res: any, status: number, body: unknown, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*' });
  res.end(type === 'application/json' ? JSON.stringify(body) : String(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (url.pathname === '/health') return send(res, 200, { ok: true, service: 'cortex-agent-os', time: new Date().toISOString() });
  if (url.pathname === '/api/agents' && req.method === 'GET') return send(res, 200, orchestrator.registry.list());
  if (url.pathname === '/api/missions' && req.method === 'GET') return send(res, 200, orchestrator.listMissions());

  if (url.pathname === '/api/missions' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let data: any;
    try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
    if (!data.goal || typeof data.goal !== 'string') return send(res, 400, { error: 'goal is required' });
    return send(res, 201, orchestrator.createMission(data.goal.trim()));
  }

  const runMatch = url.pathname.match(/^\/api\/missions\/([^/]+)\/run$/);
  if (runMatch && req.method === 'POST') {
    try { return send(res, 200, orchestrator.runMission(runMatch[1])); }
    catch { return send(res, 404, { error: 'Mission not found' }); }
  }

  if (url.pathname === '/' && req.method === 'GET') {
    try { return send(res, 200, await readFile(join(webRoot, 'index.html'), 'utf8'), 'text/html; charset=utf-8'); }
    catch { return send(res, 500, 'Mission Control UI missing', 'text/plain'); }
  }
  send(res, 404, { error: 'Not found' });
});

server.listen(port, () => console.log(`Cortex Agent OS listening on :${port}`));
