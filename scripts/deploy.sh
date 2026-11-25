#!/usr/bin/env bash
# Deploys Home Tutor to Cloudflare Workers (PWA + API in one Worker) with a D1 database.
#
#   bash scripts/deploy.sh            normal edition:  worker home-tutor,          D1 home-tutor
#   bash scripts/deploy.sh unlocked   review edition:  worker home-tutor-unlocked, D1 home-tutor-unlocked
#
# The review edition (everything unlocked, no parent PIN, noindex) has its OWN database, so review
# data never mixes with real families.
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

EDITION="${1:-standard}"
case "$EDITION" in
  standard|normal) EDITION=standard; NAME=home-tutor; DIST=dist; BUILD=build:web ;;
  unlocked|review) EDITION=unlocked; NAME=home-tutor-unlocked; DIST=dist-unlocked; BUILD=build:web:unlocked ;;
  *) echo "Unknown edition '$EDITION'. Use: bash scripts/deploy.sh [standard|unlocked]" >&2; exit 64 ;;
esac

if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "wrangler is not logged in. Run 'npx wrangler login' (OAuth) or set CLOUDFLARE_API_TOKEN; skipping deploy." >&2
  exit 2
fi

npm run "$BUILD"

find_db() {
  npx wrangler d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=s.indexOf('[');const l=m>=0?JSON.parse(s.slice(m)):[];const d=l.find(x=>x.name===process.argv[1]);process.stdout.write(d?(d.uuid||d.database_id||''):'')})" "$NAME"
}
DB_ID=$(find_db)
if [[ -z "$DB_ID" ]]; then
  npx wrangler d1 create "$NAME" >/dev/null
  DB_ID=$(find_db)
fi
if [[ -z "$DB_ID" ]]; then
  echo "Could not find or create the D1 database $NAME." >&2
  exit 1
fi

TMP=wrangler.deploy.jsonc
trap 'rm -f "$TMP"' EXIT
# Same config, with this edition's worker name, database, assets folder and EDITION variable.
sed -e "s/00000000-0000-0000-0000-000000000000/${DB_ID}/" \
    -e "s/\"name\": \"home-tutor\"/\"name\": \"${NAME}\"/" \
    -e "s/\"database_name\": \"home-tutor\"/\"database_name\": \"${NAME}\"/" \
    -e "s#\"directory\": \"./dist\"#\"directory\": \"./${DIST}\"#" \
    -e "s/\"EDITION\": \"standard\"/\"EDITION\": \"${EDITION}\"/" \
    wrangler.jsonc > "$TMP"
# Migrations are additive (0001, 0002, ...); wrangler applies only the ones not yet applied.
CI=1 npx wrangler d1 migrations apply "$NAME" --remote --config "$TMP"
npx wrangler deploy --config "$TMP"
echo "Deployed. Live: https://${NAME}.german-journey.workers.dev"
if [[ "$EDITION" == unlocked ]]; then
  echo "Run the review-edition e2e against it with: E2E_UNLOCKED_URL=https://${NAME}.german-journey.workers.dev npx playwright test --project=unlocked"
else
  echo "Run the e2e suite against it with: E2E_BASE_URL=https://${NAME}.german-journey.workers.dev npx playwright test"
fi
