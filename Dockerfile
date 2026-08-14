# FluxorX - Multi-stage Dockerfile
# Stage 1: install dependencies only (cached separately from source changes)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# They must be passed as build args, not runtime env vars.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: minimal production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user, do not run the app as root inside the container
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output only, this is why output: "standalone" matters,
# it excludes node_modules and dev-only files from the final image
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# RESEND_API_KEY is read at runtime, not build time, it is passed via
# docker-compose or `docker run -e` and does not need to be an ARG above
CMD ["node", "server.js"]
