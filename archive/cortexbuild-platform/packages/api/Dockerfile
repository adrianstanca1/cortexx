FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/db/package.json    packages/db/tsconfig.json    ./packages/db/
# COPY packages/db/drizzle       ./packages/db/drizzle  # no drizzle dir yet
COPY packages/api/package.json   packages/api/tsconfig.json   ./packages/api/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src ./packages/shared/src
COPY packages/db/src     ./packages/db/src
COPY packages/api/src    ./packages/api/src
RUN pnpm --filter ./packages/shared run build && \
    pnpm --filter ./packages/db run build && \
    pnpm --filter ./packages/api run build || true

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/drizzle ./drizzle
EXPOSE 3001
CMD ["node", "dist/server.js"]
