#!/usr/bin/env bash
# Stage 2 evidence capture. Never modifies the dependency tree or application data.
set -uo pipefail
export CI=true
mkdir -p security-audit-artifacts
node --version | tee security-audit-artifacts/node-version.txt
npm --version | tee security-audit-artifacts/npm-version.txt
git rev-parse HEAD > security-audit-artifacts/commit-sha.txt
sha256sum package-lock.json > security-audit-artifacts/lockfile-sha256.txt
npm ls --all --json > security-audit-artifacts/npm-tree.json 2>security-audit-artifacts/npm-tree-stderr.txt
tree_rc=$?
printf '%s\n' "$tree_rc" > security-audit-artifacts/npm-tree-exit-code.txt
if [ "$tree_rc" -ne 0 ]; then echo "Dependency tree is invalid; audit evidence retained." >&2; exit "$tree_rc"; fi
for spec in "web:apps/web-portal" "customer:apps/mobile-app" "partner:apps/partner-app"; do
  name="${spec%%:*}"
  workspace="${spec#*:}"
  npm audit --workspace "$workspace" --omit=dev --json > "security-audit-artifacts/${name}-production-audit.json" 2>"security-audit-artifacts/${name}-audit-stderr.txt"
  rc=$?
  printf '%s\n' "$rc" > "security-audit-artifacts/${name}-audit-exit-code.txt"
  # npm audit intentionally exits nonzero for findings; JSON is still valid evidence.
  node -e 'const fs=require("fs");const f=process.argv[1],j=JSON.parse(fs.readFileSync(f,"utf8"));if(!j.metadata?.vulnerabilities||!j.vulnerabilities)process.exit(1); console.log(JSON.stringify({workspace:f,counts:j.metadata.vulnerabilities,packages:Object.keys(j.vulnerabilities)},null,2))' "security-audit-artifacts/${name}-production-audit.json" > "security-audit-artifacts/${name}-summary.json"
  if [ "$?" -ne 0 ]; then echo "Missing/invalid audit JSON for $name (npm exit $rc)" >&2; exit 1; fi
done
echo "Audit evidence captured. Advisory counts are NOT validated runtime exploitability."
