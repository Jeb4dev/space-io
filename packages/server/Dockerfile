# packages/server/Dockerfile

FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files first for better layer caching
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Build shared package first, then server
RUN pnpm -C packages/shared build
RUN pnpm -C packages/server build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files needed for production
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./

# Copy built packages
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/server/package.json ./packages/server/
COPY --from=build /app/packages/server/dist ./packages/server/dist

# Install production dependencies (this will properly link workspace packages)
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/packages/server
EXPOSE 8080
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
