# packages/server/Dockerfile

FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 1) Copy workspace metadata
COPY pnpm-workspace.yaml ./

# 2) Copy only the two packages used by the server
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# 3) Install/build
RUN pnpm -C packages/shared i && pnpm -C packages/shared build
RUN pnpm -C packages/server i
RUN pnpm -C packages/server build

# Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/package.json ./
EXPOSE 8080
CMD ["node", "dist/index.js"]
