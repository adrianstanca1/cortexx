// Load secrets from an untracked .env at the repo root. Tiny parser
// to avoid a runtime `dotenv` dependency. Fails open: if the file is
// missing or unreadable, env vars from it are simply absent (the
// downstream server's own validation will catch any missing values).
const fs = require('fs');
const path = require('path');
const envFromFile = (() => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return {};
    const out = {};
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch { return {}; }
})();

module.exports = {
  apps: [{
    name: 'cortexbuild-unified-api',
    cwd: '/root/cortexbuild-unified/packages/server/src',
    script: 'server.mjs',
    env: {
      NODE_ENV: 'production',
      PORT: 3333,
      // server.mjs has no auth on /api/*; keep it loopback-only.
      // Front with nginx if external reach is needed.
      HOST: '127.0.0.1',
      DATABASE_URL: 'postgresql://cortexbuild:cortexbuild123@127.0.0.1:5432/cortexbuild?sslmode=disable',
      ...envFromFile,
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 5,
    min_uptime: '10s',
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/root/.pm2/logs/cortexbuild-unified-api-error.log',
    out_file: '/root/.pm2/logs/cortexbuild-unified-api-out.log',
  }]
};
