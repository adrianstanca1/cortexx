/**
 * PM2 Ecosystem Config — CortexBuild Field API Server
 *
 * Usage (non-Docker VPS):
 *   npm install -g pm2
 *   pnpm build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # auto-start on reboot
 */
module.exports = {
  apps: [
    {
      name: "cortexbuild-field",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=512",
      env: {
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
