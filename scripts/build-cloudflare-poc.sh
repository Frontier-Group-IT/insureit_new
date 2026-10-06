#!/usr/bin/env bash
set -euo pipefail

# POC-only Cloudflare build. Installs adapter tooling without modifying package-lock.
# Trigger a fresh Cloudflare build from the cloudflare-poc branch.
npm install --no-save --workspace apps/web-portal @opennextjs/cloudflare@1.20.2 wrangler@latest
cd apps/web-portal
npx opennextjs-cloudflare build
