#!/usr/bin/env bash
set -euo pipefail

# Cloudflare POC only. This does not modify Vercel or production DNS.
npm install --no-save --workspace apps/web-portal @opennextjs/cloudflare@latest wrangler@latest
cd apps/web-portal
npx opennextjs-cloudflare build
npx wrangler deploy
