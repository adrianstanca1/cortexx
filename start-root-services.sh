#!/bin/bash
# Master boot script to launch Cortexx services inside the PRoot environment

echo "=== Fixing PRoot Environment for Database ==="

proot -r ~/alpine-rootfs -0 -b /etc/resolv.conf -b /workspace:/workspace -w /workspace/cortexx /bin/bash -c "
  # PostgreSQL refuses to run as strict 'root'.
  # We must create a dedicated unprivileged 'postgres' user inside our PRoot alpine environment to own the database process.
  
  if ! id -u postgres >/dev/null 2>&1; then
    adduser -D postgres
  fi
  
  mkdir -p /run/postgresql
  chown -R postgres:postgres /run/postgresql
  mkdir -p /var/lib/postgresql/data
  chown -R postgres:postgres /var/lib/postgresql/data
  
  # Check if database cluster exists
  if [ -z \"\$(ls -A /var/lib/postgresql/data 2>/dev/null)\" ]; then
    echo 'Initializing Database as postgres user...'
    su - postgres -c 'initdb -D /var/lib/postgresql/data'
    
    # Start momentarily to set password and create DB
    su - postgres -c 'pg_ctl -D /var/lib/postgresql/data -w start'
    sleep 2
    su - postgres -c 'psql -c \"ALTER USER postgres WITH SUPERUSER PASSWORD '\'Cumparavinde12@\'';\"'
    su - postgres -c 'psql -c \"CREATE DATABASE cortexx OWNER postgres;\"'
    su - postgres -c 'pg_ctl -D /var/lib/postgresql/data -m fast stop'
  fi
  
  # Start the DB as the postgres user
  echo 'Starting PostgreSQL...'
  su - postgres -c 'pg_ctl -D /var/lib/postgresql/data start'

  # We need to map Ollama to the right binary path inside the container.
  export PATH=\"/workspace/cortexx/node_modules/.bin:\$HOME/.local/bin:\$HOME/.local/node/bin:\$PATH\"
  
  # Clear out old crashed pm2 states
  pm2 delete all || true
  
  # We can't use 'serve' in root unless we fix its path.
  # Let's fallback to serving frontend via Next.js directly for now on 3000
  echo 'Starting Frontend, Backend, and LLM via PM2...'
  
  cat << 'CFG' > ecosystem.config.js
module.exports = {
  apps: [
    {
      name: \"cortexx-api\",
      script: \"server/index.js\",
      cwd: \"/workspace/cortexx\",
      instances: 1,
      autorestart: true,
      env: {
        PORT: 8080,
        DATABASE_URL: \"postgresql://postgres:Cumparavinde12@@localhost:5432/cortexx\"
      }
    },
    {
      name: \"cortexx-frontend\",
      script: \"npm\",
      args: \"run dev\",
      cwd: \"/workspace/cortexx\",
      instances: 1,
      autorestart: true,
      env: {
        PORT: 3000
      }
    }
  ]
};
CFG
  
  pm2 start ecosystem.config.js
  pm2 save
  echo 'ALL SERVICES ACTIVE.'
  pm2 status
"
