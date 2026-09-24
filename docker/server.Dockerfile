# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS build

WORKDIR /app
RUN npm install --global pnpm@10.34.4

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY server ./server
RUN pnpm run server:build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV WORLD_ID=global-1

RUN npm install --global pnpm@10.34.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=build --chown=node:node /app/server/dist ./server/dist

EXPOSE 3001
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/readyz >/dev/null || exit 1

CMD ["node", "server/dist/index.js"]
