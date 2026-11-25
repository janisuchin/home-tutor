#!/usr/bin/env bash
# Deploys Home Tutor to Cloudflare Workers (worker "home-tutor": PWA + API) with a D1 database.
#
# Works with either kind of wrangler login:
#   - an API token: CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID if the token sees several accounts);
#   - OAuth on a PC: run `npx wrangler login` once; no environment variables are needed.
# Never commit tokens or account ids.
#
# The real D1 database id is written only into wrangler.deploy.jsonc, a temporary copy of
# wrangler.jsonc at the repo root (gitignored, deleted afterwards). It sits next to wrangler.jsonc on
# purpose: wrangler resolves "main", "assets.directory" and "migrations_dir" relative to the config
# file, so a copy anywhere else would point those paths at the wrong folders.
set -euo pipefail
export WRANGLER_SEND_METRICS=false
cd "$(dirname "$0")/.."

if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "wrangler is not logged in. Run 'npx wrangler login' (OAuth) or set CLOUDFLARE_API_TOKEN; skipping deploy." >&2
  exit 2
fi

npm run build:web

find_db() {
  npx wrangler d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=s.indexOf('[');const l=m>=0?JSON.parse(s.slice(m)):[];const d=l.find(x=>x.name==='home-tutor');process.stdout.write(d?(d.uuid||d.database_id||''):'')})"
}
DB_ID=$(find_db)
if [[ -z "$DB_ID" ]]; then
  npx wrangler d1 create home-tutor >/dev/null
  DB_ID=$(find_db)
fi
if [[ -z "$DB_ID" ]]; then
  echo "Could not find or create the D1 database home-tutor." >&2
  exit 1
fi

TMP=wrangler.deploy.jsonc
trap 'rm -f "$TMP"' EXIT
sed "s/00000000-0000-0000-0000-000000000000/${DB_ID}/" wrangler.jsonc > "$TMP"
# Migrations are additive (0001, 0002, ...); wrangler applies only the ones not yet applied.
CI=1 npx wrangler d1 migrations apply home-tutor --remote --config "$TMP"
npx wrangler deploy --config "$TMP"
echo "Deployed. Live: https://home-tutor.german-journey.workers.dev"
echo "Run the e2e suite against it with: E2E_BASE_URL=https://home-tutor.german-journey.workers.dev npx playwright test"
