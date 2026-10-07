#!/usr/bin/env bash
set -euo pipefail

export NODE_OPTIONS="--max-old-space-size=4096"

# Production Cloudflare build from the exact commit merged into main.
# Adapter tooling is installed transiently and does not modify package-lock.json.
npm install --no-save --workspace apps/web-portal @opennextjs/cloudflare@1.20.2 wrangler@latest
cd apps/web-portal
npx opennextjs-cloudflare build
