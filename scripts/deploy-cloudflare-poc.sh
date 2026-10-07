#!/usr/bin/env bash
set -euo pipefail

# Cloudflare POC deploy only. Preserve runtime variables configured in the
# Cloudflare dashboard and do not touch Vercel or production DNS.
cd apps/web-portal
npx wrangler deploy --keep-vars
