FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY types ./types
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/cli ./apps/cli
COPY tests ./tests
RUN npx tsc -p tsconfig.json
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4310
COPY --from=build /app/dist ./dist
COPY apps/web ./apps/web
COPY package.json ./package.json
EXPOSE 4310
CMD ["node","dist/apps/api/src/server.js"]
