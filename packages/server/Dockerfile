# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY ../../pnpm-workspace.yaml ./
COPY ../../packages/shared ./packages/shared
COPY ./ ./packages/server
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm -C packages/shared i && pnpm -C packages/shared build
RUN pnpm -C packages/server i && pnpm -C packages/server build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/package.json ./
COPY --from=build /app/packages/server/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
