#!/usr/bin/env bash
set -euo pipefail

# Production Cloudflare deploy. Runtime variables configured in Cloudflare are
# preserved and this command does not touch Vercel or portal.insureit.in DNS.
cd apps/web-portal
npx wrangler deploy --keep-vars
