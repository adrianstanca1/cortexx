import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import puppeteer from 'puppeteer';
import Redis from 'ioredis';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const server = http.createServer(app);

// The gateway fronts a Puppeteer browser instance, so an auth bypass here is a
// full control-plane compromise. Refuse to boot without a real secret rather
// than falling back to a value that is published in .env.example.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    'FATAL: JWT_SECRET is not set. Generate one with:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n' +
    'Then add BROWSER_GATEWAY_JWT_SECRET to the repo-root .env (see VAULT.md).'
  );
  process.exit(1);
}

// Same-origin by default: Caddy serves this service under the main site's
// origin, so a wildcard is unnecessary and would let any site drive the
// browser control plane. Override with ALLOWED_ORIGIN for split-host setups.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://cortexbuildpro.tech';

const io = new SocketIOServer(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Redis connection for state management.
// Host/port come from the environment so the container resolves the compose
// service name rather than localhost. Defaults suit `npm run dev` on a host.
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
});

// In-memory agent state
const agentStates = {};
const browserInstances = new Map();

// JWT authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard route - serves the control panel
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Browser Gateway Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root { --primary: #2563eb; --primary-dark: #1e40af; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --muted: #64748b; --success: #10b981; --error: #ef4444; --warning: #f59e0b; }
        body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: var(--card); padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
        h1 { font-size: 1.5rem; font-weight: 600; color: var(--text); }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .status-card { background: var(--card); padding: 15px; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .status-card h3 { font-size: 0.875rem; font-weight: 600; margin-bottom: 8px; }
        .status-card .value { font-size: 1.25rem; color: var(--primary); }
        .status-card .error { color: var(--error); }
        .controls { background: var(--card); padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
        .controls h3 { margin-bottom: 15px; font-size: 1rem; font-weight: 600; }
        .control-row { display: grid; grid-template-columns: 150px 1fr 120px; gap: 10px; align-items: center; margin-bottom: 10px; }
        .control-row label { font-size: 0.875rem; color: var(--muted); }
        .control-row select, .control-row input { padding: 8px; border: 1px solid var(--muted); border-radius: 6px; background: var(--bg); color: var(--text); }
        .control-row button { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; transition: background 0.2s; }
        .control-row button:hover { background: var(--primary-dark); }
        .control-row button:disabled { background: var(--muted); cursor: not-allowed; }
        .log-area { background: var(--card); padding: 15px; border-radius: 8px; height: 300px; overflow: auto; margin: 15px 0; font-family: monospace; font-size: 0.75rem; color: var(--muted); }
        .log-entry { padding: 4px 0; border-bottom: 1px solid var(--muted); }
        .log-entry.success { color: var(--success); }
        .log-entry.error { color: var(--error); }
        .log-entry.info { color: var(--primary); }
        #connection-status { padding: 8px 16px; background: var(--muted); color: white; border-radius: 20px; font-size: 0.75rem; margin-bottom: 15px; display: inline-block; }
        .badge { display: inline-block; padding: 3px 8px; background: var(--muted); border-radius: 10px; font-size: 0.65rem; margin-left: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>🌐 Browser Gateway Dashboard</h1>
          <div id="connection-status" class="badge">Connecting...</div>
        </header>
        
        <div class="status-grid">
          <div class="status-card">
            <h3>Browser Instances</h3>
            <div class="value" id="browser-count">0</div>
          </div>
          <div class="status-card">
            <h3>Active Agents</h3>
            <div class="value" id="agent-count">0</div>
          </div>
          <div class="status-card">
            <h3>Redis Status</h3>
            <div class="value" id="redis-status">Connecting...</div>
          </div>
        </div>
        
        <div class="controls">
          <h3>Browser Control</h3>
          <div class="control-row">
            <label>Action</label>
            <select id="action-select">
              <option value="navigate">Navigate URL</option>
              <option value="click">Click Element</option>
              <option value="input">Input Text</option>
              <option value="screenshot">Take Screenshot</option>
              <option value="evaluate">Evaluate JS</option>
              <option value="reload">Reload Page</option>
            </select>
            <button onclick="executeAction()">Execute</button>
          </div>
          <div class="control-row" id="action-params" style="display: none;">
            <label>Parameters</label>
            <input type="text" id="action-param" placeholder="URL or selector">
            <button onclick="executeAction()">Execute</button>
          </div>
          <button onclick="refreshAgents()">Refresh Agents</button>
        </div>
        
        <div class="controls">
          <h3>Agent Coordination</h3>
          <div class="control-row">
            <label>Agent</label>
            <select id="agent-select">
              <option value="all">All Agents</option>
              <!-- Dynamically populated -->
            </select>
          </div>
          <div class="control-row">
            <label>Command</label>
            <select id="agent-command">
              <option value="status">Get Status</option>
              <option value="restart">Restart</option>
              <option value="execute">Execute Task</option>
            </select>
            <input type="text" id="agent-task" placeholder="Task description" style="width: 300px;">
            <button onclick="sendAgentCommand()">Send</button>
          </div>
        </div>
        
        <div class="controls">
          <h3>System Logs</h3>
          <div class="log-area" id="log-area">
            <div class="log-entry info">Dashboard loading...</div>
          </div>
        </div>
      </div>

      <script>
        const socket = new WebSocket('ws://' + location.host + '/ws');
        const logArea = document.getElementById('log-area');
        const browserCount = document.getElementById('browser-count');
        const agentCount = document.getElementById('agent-count');
        const redisStatus = document.getElementById('redis-status');
        const actionSelect = document.getElementById('action-select');
        const actionParams = document.getElementById('action-params');
        const agentSelect = document.getElementById('agent-select');
        const connectionStatus = document.getElementById('connection-status');

        function log(message, type = 'info') {
          const entry = document.createElement('div');
          entry.className = 'log-entry ' + type;
          entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
          logArea.appendChild(entry);
          logArea.scrollTop = logArea.scrollHeight;
        }

        socket.onopen = () => {
          connectionStatus.textContent = 'Connected';
          connectionStatus.className = 'badge success';
          log('WebSocket connected');
        };

        socket.onclose = () => {
          connectionStatus.textContent = 'Disconnected';
          connectionStatus.className = 'badge error';
          log('WebSocket disconnected', 'error');
        };

        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status') {
            browserCount.textContent = data.browser_count || 0;
            agentCount.textContent = data.agent_count || 0;
            redisStatus.textContent = data.redis_status || 'unknown';
          } else if (data.type === 'log') {
            log(data.message, data.type || 'info');
          } else if (data.type === 'agent_status') {
            log('Agent ' + data.agent_id + ': ' + data.status, 'info');
          } else if (data.type === 'browser_action') {
            log('Browser action: ' + data.action, 'success');
          }
        };

        // Execute browser action
        async function executeAction() {
          const action = actionSelect.value;
          const param = document.getElementById('action-param').value || '';
          
          if (!param) {
            alert('Please enter a parameter');
            return;
          }
          
          log('Executing: ' + action + ' with param: ' + param, 'info');
          socket.send(JSON.stringify({ type: 'browser_action', action, param }));
          
          // Show params form
          actionParams.style.display = 'block';
        }

        // Refresh agent list
        async function refreshAgents() {
          socket.send(JSON.stringify({ type: 'refresh_agents' }));
        }

        // Send agent command
        async function sendAgentCommand() {
          const agentId = agentSelect.value;
          const command = agentCommand.value;
          const task = document.getElementById('agent-task').value;
          
          if (!task) {
            alert('Please enter a task');
            return;
          }
          
          socket.send(JSON.stringify({ type: 'agent_command', agent_id: agentId, command, task }));
        }

        // Initial load
        socket.onopen && refreshAgents();
      </script>
    </body>
    </html>
  `);
});

// API: Start browser instance
app.post('/api/browser/start', authenticateToken, async (req, res) => {
  try {
    const key = req.body.key || 'default';
    
    if (browserInstances.has(key)) {
      return res.json({ status: 'already_running', instance: key });
    }
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    browserInstances.set(key, browser);
    
    logAction(`Browser instance started: ${key}`);
    res.json({ status: 'started', instance: key });
  } catch (error) {
    logAction(`Failed to start browser: ${error.message}`, 'error');
    res.status(500).json({ error: error.message });
  }
});

// API: Browser action
app.post('/api/browser/action', authenticateToken, async (req, res) => {
  try {
    const { instance, action, param } = req.body;
    const browser = browserInstances.get(instance);
    
    if (!browser) {
      return res.status(404).json({ error: `Browser instance ${instance} not found` });
    }
    
    const page = await browser.newPage();
    
    switch (action) {
      case 'navigate':
        await page.goto(param, { waitUntil: 'networkidle0' });
        break;
      case 'click':
        await page.click(param);
        break;
      case 'input':
        await page.type(param.selector, param.text);
        break;
      case 'screenshot':
        const buffer = await page.screenshot();
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(buffer);
        return;
      case 'evaluate':
        const result = await page.evaluate(param.code);
        res.json({ result });
        return;
      case 'reload':
        await page.reload();
        break;
    }
    
    const url = page.url();
    await page.close();
    logAction(`Browser action: ${action} on ${instance}`, 'success');
    res.json({ status: 'success', url });
    
  } catch (error) {
    logAction(`Browser action error: ${error.message}`, 'error');
    res.status(500).json({ error: error.message });
  }
});

// API: Agent status
app.get('/api/agents/status', authenticateToken, (req, res) => {
  res.json({ status: 'ok', agents: agentStates });
});

// API: Agent command
app.post('/api/agent/command', authenticateToken, (req, res) => {
  const { agent_id, command, task } = req.body;
  
  // Store the command for agents to pick up
  redis.set(`agent:${agent_id}:command`, JSON.stringify({ command, task }));
  
  logAction(`Agent command sent: ${agent_id} - ${command}: ${task}`);
  res.json({ status: 'command_queued', agent_id, command, task });
});

// API: Get all system state
app.get('/api/system-state', authenticateToken, async (req, res) => {
  try {
    const agents = await redis.keys('agent:*:status');
    const agentDetails = await Promise.all(agents.map(key => redis.get(key)));
    
    const browserCount = browserInstances.size;
    const redisPing = await redis.ping();
    
    res.json({
      status: 'ok',
      browser_count: browserCount,
      redis_status: redisPing,
      agents: agentDetails.reduce((acc, curr) => {
        if (curr) acc.push(JSON.parse(curr));
        return acc;
      }, [])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket handler
io.on('connection', (socket) => {
  logAction(`Client connected: ${socket.id}`);
  
  socket.on('browser_action', async (data) => {
    try {
      const { instance, action, param } = data;
      const browser = browserInstances.get(instance);
      
      if (!browser) {
        socket.emit('browser_action_result', { instance, action, success: false, error: 'Browser not found' });
        return;
      }
      
      const page = await browser.newPage();
      
      switch (action) {
        case 'navigate':
          await page.goto(param, { waitUntil: 'networkidle0' });
          break;
        case 'click':
          await page.click(param);
          break;
        case 'input':
          await page.type(param.selector, param.text);
          break;
        case 'screenshot':
          const buffer = await page.screenshot();
          socket.emit('browser_action_result', { instance, action, success: true, data: buffer.toString('base64') });
          await page.close();
          return;
        case 'evaluate':
          const result = await page.evaluate(param.code);
          socket.emit('browser_action_result', { instance, action, success: true, data: result });
          await page.close();
          return;
        case 'reload':
          await page.reload();
          break;
      }
      
      await page.close();
      socket.emit('browser_action_result', { instance, action, success: true, url: page.url() });
    } catch (error) {
      socket.emit('browser_action_result', { success: false, error: error.message });
    }
  });
  
  socket.on('agent_command', (data) => {
    const { agent_id, command, task } = data;
    redis.set(`agent:${agent_id}:command`, JSON.stringify({ command, task }));
    socket.emit('agent_command_result', { agent_id, command, task, status: 'queued' });
  });
  
  socket.on('disconnect', () => {
    logAction(`Client disconnected: ${socket.id}`);
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3002;

server.listen(PORT, async () => {
  console.log(`🚀 Browser Gateway running on port ${PORT}`);
  
  // Initialize Redis connection status
  try {
    await redis.ping();
    logAction('Redis connected successfully');
  } catch (error) {
    logAction(`Redis connection failed: ${error.message}`, 'error');
  }
  
  // Initialize browser instances count
  logAction(`Browser gateway initialized with ${browserInstances.size} instances`);
});

function logAction(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
  
  // Broadcast to all connected clients
  io.emit('log', { type, message, timestamp });
}

export default app;