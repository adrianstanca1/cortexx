# Cortexx API — production image
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install deterministic production dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy ONLY runtime files — never `COPY . .`, which would bake server/.env
# (real JWT_SECRET / WEBHOOK_SECRET / VAPID keys), server/.env.example,
# db_status.log and any host node_modules into the image layer. Even though the
# container runs as `USER node` and reads env via compose env_file, a secret
# baked into a layer is recoverable by anyone who can pull/inspect the image.
COPY index.js healthcheck.js ollama-init.sh ./
COPY routes/ ./routes/
COPY db/ ./db/

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

USER node
CMD ["node", "index.js"]
