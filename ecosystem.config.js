module.exports = {
  apps: [
    {
      name: "cortexx-api",
      script: "server/index.js",
      cwd: "/workspace/cortexx",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
        LLM_RUNTIME: "ollama",
        OLLAMA_BASE: "http://127.0.0.1:11434",
        OLLAMA_MODEL: "qwen2.5-coder:7b",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/cortexx"
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
    }
  ]
};
