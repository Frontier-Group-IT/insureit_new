#!/usr/bin/env bash
set -euo pipefail

# POC-only Cloudflare build. Installs adapter tooling without modifying package-lock.
npm install --no-save --workspace apps/web-portal @opennextjs/cloudflare@latest wrangler@latest
cd apps/web-portal
npx opennextjs-cloudflare build
