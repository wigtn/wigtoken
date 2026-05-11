FROM node:20-slim AS builder
WORKDIR /app

# Native deps for better-sqlite3 prebuild fallback.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm ci
RUN npm run build

COPY web ./web
RUN cd web && npm ci && npm run build

FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10103
ENV STATS_DB_PATH=/data/db/stats.db
ENV CLAUDE_PROJECTS_DIR=/data/claude

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

RUN mkdir -p /data/db /data/claude

EXPOSE 10103
USER node
CMD ["node", "dist/cli.js", "start"]
