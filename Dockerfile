# ──────────────────────────────────────────────
# Stage 1 – base: Node + pnpm
# ──────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ──────────────────────────────────────────────
# Stage 2 – deps: install all dependencies
# ──────────────────────────────────────────────
FROM base AS deps
# Copy only manifests first for optimal layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ──────────────────────────────────────────────
# Stage 3 – dev: hot-reload development server
# ──────────────────────────────────────────────
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ──────────────────────────────────────────────
# Stage 4 – build: compile TypeScript + Vite
# ──────────────────────────────────────────────
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm build

# ──────────────────────────────────────────────
# Stage 5 – prod: serve built assets + auth API via Node
# ──────────────────────────────────────────────
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app

# Install only what the runtime server needs (tsx is required to run .ts directly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod=false --ignore-scripts

COPY --from=build /app/dist ./dist
COPY server.ts ./server.ts
COPY src/server ./src/server
COPY src/config ./src/config
COPY tsconfig.json tsconfig.node.json tsconfig.app.json ./

RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup && \
    mkdir -p /app/data && \
    chown -R appuser:appgroup /app

USER appuser
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:4173/ || exit 1
CMD ["pnpm", "exec", "tsx", "server.ts"]
