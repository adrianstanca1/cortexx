# FreeMilk runtime image for the Next.js web application.
FROM node:26-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .

# Prisma generation and Next's build need configuration, but must not connect
# to or bake credentials for any real database or production host. Public URLs
# are intentionally left unset: the app falls back to its canonical site URL
# for metadata/sitemap, and runtime auth uses the request host (AUTH_TRUST_HOST).
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    NEXTAUTH_SECRET=build-placeholder-not-used-at-runtime
RUN npx prisma generate && npm run build

FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    AUTH_TRUST_HOST=true \
    DATABASE_URL=postgresql://preview:preview@127.0.0.1:5432/preview \
    UPLOAD_DIR=/tmp/cortexx-uploads
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/cortexx-entrypoint
RUN chmod 755 /usr/local/bin/cortexx-entrypoint && mkdir -p /tmp/cortexx-uploads && chown node:node /tmp/cortexx-uploads

USER node
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/cortexx-entrypoint"]
