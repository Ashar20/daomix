#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Static env
export DAOCHAIN_WS_URL="${DAOCHAIN_WS_URL:-ws://127.0.0.1:9944}"
export DAOCHAIN_HTTP_URL="${DAOCHAIN_HTTP_URL:-http://127.0.0.1:9933}"
export DAOCHAIN_ADMIN_SEED="${DAOCHAIN_ADMIN_SEED:-//Alice}"
export DAOCHAIN_TALLY_SEED="${DAOCHAIN_TALLY_SEED:-//Alice}"
export DAOCHAIN_VOTER_SEEDS="${DAOCHAIN_VOTER_SEEDS:-//Bob,//Charlie,//Dave}"
export DAOCHAIN_VOTER_VOTES="${DAOCHAIN_VOTER_VOTES:-ALICE,BOB,ALICE}"
export DAOCHAIN_ELECTION_ID="${DAOCHAIN_ELECTION_ID:-42}"
export DAOCHAIN_TRANSPORT_ENABLED="${DAOCHAIN_TRANSPORT_ENABLED:-false}"
export MIX_NODE_URLS="${MIX_NODE_URLS:-http://127.0.0.1:4001}"

# Dynamic env (read generated files and mix-node health)
export MIX_NODE_PUBLIC_KEYS="$(curl -s http://127.0.0.1:4001/health | sed -n 's/.*\"nodePublicKey\":\"\\([^\"]*\\)\".*/\\1/p')"
export DAOMIX_TALLY_SECRET_KEY="$(node -p 'JSON.parse(require(\"fs\").readFileSync(\".tmp-tally.json\",\"utf8\")).sk')"
export DAOMIX_TALLY_PUBLIC_KEY="$(node -p 'JSON.parse(require(\"fs\").readFileSync(\".tmp-tally.json\",\"utf8\")).pk')"
export DAOMIX_SENDER_SECRET_KEY="$(node -p 'JSON.parse(require(\"fs\").readFileSync(\".tmp-sender.json\",\"utf8\")).sk')"
export DAOMIX_SENDER_PUBLIC_KEY="$(node -p 'JSON.parse(require(\"fs\").readFileSync(\".tmp-sender.json\",\"utf8\")).pk')"

echo "[E2E] Using mix-node pub: $MIX_NODE_PUBLIC_KEYS"
echo "[E2E] WS: $DAOCHAIN_WS_URL"

npm run test:daochain-e2e --silent



