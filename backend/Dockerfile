FROM node:24-trixie-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json nest-cli.json ./
# La generación no conecta a una base; no se necesitan secretos durante el build.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci
COPY src ./src
RUN npm run build

FROM node:24-trixie-slim AS production-deps
WORKDIR /app
COPY package*.json ./
# El cliente Prisma ya se genera en build; los paquetes nativos incluyen precompilados.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=verbose

FROM node:24-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOADS_DIR=/app/uploads
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/src/shared/security ./src/shared/security
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package*.json ./
COPY scripts ./scripts
RUN mkdir -p /app/uploads
EXPOSE 4000
CMD ["node", "dist/main.js"]
