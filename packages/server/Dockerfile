# packages/server/Dockerfile

# ========= Builder =========
FROM node:20-alpine AS build
WORKDIR /app

# Use the same pnpm version as your lockfile (adjust if needed)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Workspace manifests (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install WITH devDependencies (needed for TypeScript in the builder)
RUN pnpm install --frozen-lockfile --prod=false

# Copy sources
COPY packages/shared packages/shared
COPY packages/server packages/server

# Compile shared, then server using the workspace TypeScript
RUN pnpm -w --filter @game/shared run build \
 && pnpm -w --filter @game/server  run build

# ========= Runtime =========
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Workspace manifests
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/tsconfig.base.json ./

# Copy only what's needed at runtime
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist           packages/shared/dist
COPY --from=build /app/packages/server/package.json  packages/server/package.json
COPY --from=build /app/packages/server/dist          packages/server/dist

# Install production deps and link workspace packages
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/packages/server
EXPOSE 18080
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
