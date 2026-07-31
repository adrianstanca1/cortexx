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
COPY index.js ollama-init.sh security.js logger.js collections.js ./
COPY routes/ ./routes/
COPY db/ ./db/
# lib/ holds runtime modules (e.g. secret-store.js) required by index.js and
# every route. The explicit-COPY list above previously omitted it, producing a
# MODULE_NOT_FOUND crash loop on boot (prod /api/health 502). Keep this in sync
# with every top-level server/ require() target.
COPY lib/ ./lib/
# secret-store.js ships as 0600 on disk; normalize so the non-root runtime
# (USER node) can read it. Never widen beyond the needed read bit.
RUN chmod -R u+rwX,go+rX lib/

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

USER node
CMD ["node", "index.js"]
