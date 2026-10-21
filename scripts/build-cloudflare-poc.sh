#!/usr/bin/env bash
set -euo pipefail

# Cloudflare production build from the branch selected as Production in
# Cloudflare Git integration. Keep this path stable because the Cloudflare
# project currently invokes: bash scripts/build-cloudflare-poc.sh
export NODE_OPTIONS="--max-old-space-size=4096"
export INSUREIT_CLOUDFLARE_BUILD="1"

npm install --no-save --workspace apps/web-portal @opennextjs/cloudflare@1.20.8 wrangler@latest
cd apps/web-portal
# Temporary Cloudflare TESTING-only bypass: OpenNext currently rejects Next.js 15.5.27
# at its support-policy validation even though this adapter's peer range accepts it.
# Does not waive security review; remove after a separately tested Next.js patch update.
npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion
