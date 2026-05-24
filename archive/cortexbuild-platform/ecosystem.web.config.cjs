module.exports = {
  apps: [
    {
      name: 'cortexbuild-platform-web',
      cwd: '/var/www/cortexbuild-platform/web-server',
      script: 'apps/web/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
      },
      error_file: '/var/log/pm2/platform-web-err.log',
      out_file: '/var/log/pm2/platform-web-out.log',
      merge_logs: true,
    },
  ],
};
