FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY server ./server

ENV NODE_ENV=production

EXPOSE 3001

CMD ["pnpm", "run", "server"]
