/**
 * CortexBuild Ultimate — Deploy Webhook
 * Called by GitHub Actions on every push to main.
 * Runs: git pull → npm run build → reload nginx (host reload preferred; docker fallback if present)
 *
 * Protected by DEPLOY_SECRET env var. No JWT auth needed.
 */
const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const router = express.Router();

const APP_DIR = path.join(__dirname, '..', '..');
const DEPLOY_SCRIPT = [
  `cd ${APP_DIR}`,
  'git pull origin main',
  'npm ci --prefer-offline 2>/dev/null || npm install',
  'npm run build',
  '(docker restart cortexbuild-nginx 2>/dev/null) || (systemctl reload nginx 2>/dev/null) || (service nginx reload 2>/dev/null) || (nginx -s reload 2>/dev/null) || true',
].join(' && ');

let deploying = false;

router.post('/', (req, res) => {
  const secret = process.env.DEPLOY_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');

  if (!secret || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (deploying) {
    return res.status(409).json({ error: 'Deploy already in progress' });
  }

  // Respond immediately so GitHub Actions doesn't time out
  res.json({ ok: true, message: 'Deploy started', timestamp: new Date().toISOString() });

  deploying = true;
  console.log('[deploy] Starting deploy at', new Date().toISOString());

  execFile('bash', ['-c', DEPLOY_SCRIPT], { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    deploying = false;
    if (err) {
      console.error('[deploy] FAILED:', err.message);
      console.error('[deploy] stderr:', stderr);
    } else {
      console.log('[deploy] SUCCESS');
      console.log('[deploy] stdout:', stdout.slice(-500));
    }
  });
});

// Status endpoint — lets GitHub Actions poll for completion
router.get('/status', (req, res) => {
  const secret = process.env.DEPLOY_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!secret || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ deploying, timestamp: new Date().toISOString() });
});

module.exports = router;
