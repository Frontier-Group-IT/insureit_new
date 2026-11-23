# Dedicated Windows-hosted Next.js runtime for the canonical AI Studio actions.
# Build from the repository root; only the path-restricted proxy is published.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    && npm ci --no-audit --no-fund \
    && npm run build --workspace apps/web-portal
EXPOSE 3001
CMD ["npm","run","start","--workspace","apps/web-portal","--","-p","3001","-H","0.0.0.0"]
