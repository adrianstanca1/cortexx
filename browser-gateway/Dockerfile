FROM node:22-alpine
RUN apk add --no-cache chromium ca-certificates font-noto nss
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.js ./
ENV NODE_ENV=production PORT=3002 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
USER node
EXPOSE 3002
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:3002/health >/dev/null || exit 1
CMD ["node", "server.js"]
