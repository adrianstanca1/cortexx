# Cortexx API — production image
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "index.js"]
