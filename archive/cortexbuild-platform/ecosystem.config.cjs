module.exports = {
  apps: [
    {
      name: 'cortexbuild-platform-api',
      cwd: '/root/cortexbuild-platform/packages/api',
      script: '/usr/bin/npx',
      args: 'tsx src/server.ts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        DATABASE_URL: 'postgresql://cortexbuild:3cff002e2c62d7ab14b33f71900e7a8c4c689b415e1c1023@127.0.0.1:55432/cortexbuild_platform?sslmode=disable',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'cortexbuild-production-secret-key-2025',
      },
      error_file: '/var/log/pm2/platform-api-err.log',
      out_file: '/var/log/pm2/platform-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
