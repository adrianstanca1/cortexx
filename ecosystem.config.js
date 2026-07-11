module.exports = {
  apps: [
    {
      name: "cortexx-api",
      script: "server/index.js",
      cwd: "/workspace/cortexx",
      instances: 1,
      autorestart: true,
      env: {
        PORT: 8080,
        LLM_RUNTIME: "ollama",
        OLLAMA_BASE: "http://127.0.0.1:11434",
        OLLAMA_MODEL: "qwen2.5-coder:7b",
        DATABASE_URL: "postgresql://postgres:Cumparavinde12@@localhost:5432/cortexx"
      }
    },
    {
      name: "ollama-daemon",
      script: "ollama",
      args: "serve",
      cwd: "/home/hermeswebui/.hermes/home/.local/bin",
      interpreter: "none",
      autorestart: true,
      env: {
        OLLAMA_HOST: "127.0.0.1:11434"
      }
    },
    {
      name: "cortexx-frontend",
      script: "./start-frontend.sh",
      cwd: "/workspace/cortexx",
      instances: 1,
      autorestart: true,
      env: {
        PORT: 3000
      }
    },
    {
      name: "cloudflare-tunnel-frontend",
      script: "cloudflared",
      args: "tunnel --url http://localhost:3000 --no-autoupdate",
      interpreter: "none",
      autorestart: true
    },
    {
      name: "cloudflare-tunnel-api",
      script: "cloudflared",
      args: "tunnel --url http://localhost:8080 --no-autoupdate",
      interpreter: "none",
      autorestart: true
    }
  ]
};
