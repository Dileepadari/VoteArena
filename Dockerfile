# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- builder
# The client bundle needs the dev dependencies (Vite, React, d3), but the
# running server does not. Building in a separate stage keeps them out of the
# final image instead of shipping a toolchain to production.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# better-sqlite3 falls back to compiling from source when no prebuild matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY src ./src
COPY index.html ./
COPY public ./public

RUN npm run build

# ------------------------------------------------------------------ deps
# Runtime dependencies only, rebuilt against the same Node ABI as the runner.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------- runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/votearena.db

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# The database lives on a volume: without one, every restart loses the votes.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/server/index.js"]
