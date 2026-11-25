#!/usr/bin/env bash
# Deploys Home Tutor to Cloudflare Workers (worker "home-tutor": PWA + API) with a D1 database.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment. Never commit them.
# The D1 database id is written to a temporary config only, so no account details enter the repo.
set -euo pipefail
export WRANGLER_SEND_METRICS=false
cd "$(dirname "$0")/.."

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required; skipping deploy." >&2
  exit 2
fi

npm run build:web

DB_ID=$(npx wrangler d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=JSON.parse(s);const d=l.find(x=>x.name==='home-tutor');process.stdout.write(d?d.uuid:'')})")
if [[ -z "$DB_ID" ]]; then
  npx wrangler d1 create home-tutor
  DB_ID=$(npx wrangler d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=JSON.parse(s);process.stdout.write(l.find(x=>x.name==='home-tutor').uuid)})")
fi

TMP=.wrangler/deploy.jsonc
mkdir -p .wrangler
sed "s/00000000-0000-0000-0000-000000000000/${DB_ID}/" wrangler.jsonc > "$TMP"
npx wrangler d1 migrations apply home-tutor --remote --config "$TMP"
npx wrangler deploy --config "$TMP"
echo "Deployed. Run the e2e suite against it with: E2E_BASE_URL=https://home-tutor.<subdomain>.workers.dev npx playwright test"
