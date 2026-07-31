# syntax=docker/dockerfile:1

# --- Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
# Skip lifecycle scripts here (postinstall needs prisma/schema.prisma)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app
# Prisma schema requires DATABASE_URL at generate time; value is unused for client gen
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Runtime ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone Next server + static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p public/uploads \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

# Apply schema then start (DATABASE_URL must be set by Railway at runtime)
CMD ["sh", "-c", "npx prisma db push && node server.js"]
