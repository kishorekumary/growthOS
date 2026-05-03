# Stage 1: install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: build with placeholder values for NEXT_PUBLIC_* vars
# Real values are injected at container startup via entrypoint — see docker/app-entrypoint.sh
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_PUBLIC_SUPABASE_URL=__NEXT_PUBLIC_SUPABASE_URL__
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=__NEXT_PUBLIC_SUPABASE_ANON_KEY__
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=__NEXT_PUBLIC_VAPID_PUBLIC_KEY__
ENV NEXT_PUBLIC_APP_URL=__NEXT_PUBLIC_APP_URL__

RUN npm run build

# Stage 3: minimal production runner (~200MB)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache su-exec && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# entrypoint runs as root to do the sed replacement, then drops to nextjs user
COPY docker/app-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
