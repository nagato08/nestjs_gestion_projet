# =========================================
# STAGE 1 — Builder : install + compile
# =========================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

# Retries npm pour résilience aux coupures réseau
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --prefer-offline --no-audit --no-fund

COPY . .

RUN npx prisma generate
RUN npm run build

# =========================================
# STAGE 2 — Runtime : image minimale
# =========================================
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# openssl pour Prisma, curl pour le healthcheck
RUN apk add --no-cache openssl curl

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Installer les deps de prod + générer le client Prisma
# Les build-tools sont temporaires (--virtual) : suppression après build
# prisma + dotenv installés en plus (devDeps) : requis par prisma.config.ts
# et par "prisma migrate deploy" au runtime (--no-save : lockfile intact)
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000

RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && npm ci --omit=dev --prefer-offline --no-audit --no-fund \
  && npm install --no-save --prefer-offline --no-audit --no-fund prisma dotenv \
  && npx prisma generate \
  && npm cache clean --force \
  && apk del .build-deps

# Code compilé
COPY --from=builder /app/dist ./dist

# User non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 \
  && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/health || exit 1

CMD ["node", "dist/src/main.js"]
