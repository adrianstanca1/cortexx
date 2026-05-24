FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/db/package.json    packages/db/tsconfig.json    ./packages/db/
COPY apps/web/package.json       apps/web/tsconfig.json       ./apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src ./packages/shared/src
COPY packages/db/src     ./packages/db/src
COPY apps/web/src        ./apps/web/src
COPY apps/web/public     ./apps/web/public
COPY apps/web/tailwind.config.ts apps/web/postcss.config.mjs apps/web/next.config.ts ./apps/web/
RUN pnpm --filter ./packages/shared run build
RUN pnpm --filter ./apps/web run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
