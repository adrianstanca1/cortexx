# Browser Gateway — Puppeteer + Socket.IO agent control plane
FROM node:20-alpine

# Chromium runtime + shared libs. Puppeteer's bundled Chrome needs these on
# alpine; without them the container boots but every browser launch throws
# "Failed to launch the browser process".
#   nss/nsis        — TLS + client certs
#   atk/atk-bridge  — accessibility tree, required for CDP input events
#   cups-libs       — headless print-to-PDF
#   libdrm/libxkb   — GPU/DRM, headless still links against these
#   libXcomposite, libXdamage, libXrandr, libXfixes, libxshmfence
#   pango, alsa-lib — text rendering and audio
#   cairo           — 2D canvas
RUN apk add --no-cache \
      nss \
      nsis \
      atk \
      at-spi2-atk \
      cups-libs \
      libdrm \
      libxkbcommon \
      libXcomposite \
      libXdamage \
      libXrandr \
      libXfixes \
      libxshmfence \
      libXext \
      libX11 \
      pango \
      alsa-lib \
      cairo

# Chromium refuses to run as root without this sandbox opt-out. The container
# is single-purpose and network-isolated to the compose network; if you need a
# stronger boundary, run it as a non-root user and keep --no-sandbox off.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

WORKDIR /app

# Dependencies first so the npm layer caches across code changes.
# `npm ci` (not --production/--omit=dev): the flag is deprecated in npm 9+ and
# `npm ci` already installs exactly what the lockfile pins.
COPY package.json package-lock.json ./
RUN npm ci

COPY server.js ./

EXPOSE 3002

# Bound to all interfaces inside the container; Caddy is the only ingress
# (see Caddyfile handle /browser-gateway/*). No host port is published.
CMD ["node", "server.js"]