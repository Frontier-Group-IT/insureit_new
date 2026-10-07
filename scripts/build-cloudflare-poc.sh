#!/usr/bin/env bash
set -euo pipefail

# Cloudflare production build from the branch selected as Production in
# Cloudflare Git integration. Keep this path stable because the Cloudflare
# project currently invokes: bash scripts/build-cloudflare-poc.sh
export NODE_OPTIONS="--max-old-space-size=4096"

npm install --no-save --workspace apps/web-portal @opennextjs/cloudflare@1.20.2 wrangler@latest
cd apps/web-portal
npx opennextjs-cloudflare build
