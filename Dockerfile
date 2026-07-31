# syntax=docker/dockerfile:1
#
# Railway / production image.
# Important: prisma/schema.prisma is in git (not gitignored). The old failure was
# running `npm ci` → postinstall `prisma generate` BEFORE the schema was copied.

# --- Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
# Dummy URL only so Prisma can parse schema if postinstall ever runs
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
COPY package.json package-lock.json ./
# Copy schema BEFORE install so postinstall prisma generate can find it
COPY prisma ./prisma
# Prefer ignoring scripts; generate explicitly in builder after full source copy
RUN npm ci --ignore-scripts

# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
# Explicit path — fails loudly if schema missing from context
RUN test -f prisma/schema.prisma \
  && npx prisma generate --schema=prisma/schema.prisma
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

# Real DATABASE_URL must come from Railway at runtime
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma && node server.js"]
