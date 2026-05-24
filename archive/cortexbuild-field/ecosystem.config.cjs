/**
 * PM2 Ecosystem Config — CortexBuild Field API Server
 *
 * Usage (non-Docker VPS):
 *   npm install -g pm2
 *   pnpm build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # auto-start on reboot
 *
 * NB: `pm2 restart` does NOT re-read this file's env block — only
 * `pm2 delete cortexbuild-field && pm2 start ecosystem.config.cjs`
 * forces a fresh read of process.env from .env.
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(filepath) {
  try {
    return fs
      .readFileSync(filepath, "utf8")
      .split("\n")
      .reduce((env, line) => {
        const m = line.match(/^([A-Z][A-Z0-9_]+)=(.*)$/);
        if (m) {
          let v = m[2];
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          env[m[1]] = v;
        }
        return env;
      }, {});
  } catch {
    return {};
  }
}

const dotenv = loadEnvFile(path.join(__dirname, ".env"));

module.exports = {
  apps: [
    {
      name: "cortexbuild-field",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=512",
      env: {
        ...dotenv,
        NODE_ENV: "production",
        PORT: 3005,
      },
      // Restart on crash, with exponential back-off
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,

      // Log rotation
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      merge_logs: true,

      // Memory limit — restart if over 512 MB
      max_memory_restart: "512M",

      // Watch mode — disabled in production
      watch: false,
    },
  ],
};
