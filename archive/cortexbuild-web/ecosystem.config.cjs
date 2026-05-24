module.exports = {
  apps: [{
    name: 'cortexbuild-web-api',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
