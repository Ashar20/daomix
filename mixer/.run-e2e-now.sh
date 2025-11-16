#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Ensure temp keys exist
if [ ! -f .tmp-tally.json ]; then
  TS_NODE_FILES=true npx ts-node -e "const {generateKeypair,toHex,initCrypto}=require('./src/crypto');(async()=>{await initCrypto();const kp=generateKeypair();require('fs').writeFileSync('.tmp-tally.json',JSON.stringify({sk:toHex(kp.secretKey),pk:toHex(kp.publicKey)}));})();"
fi
if [ ! -f .tmp-sender.json ]; then
  TS_NODE_FILES=true npx ts-node -e "const {generateKeypair,toHex,initCrypto}=require('./src/crypto');(async()=>{await initCrypto();const kp=generateKeypair();require('fs').writeFileSync('.tmp-sender.json',JSON.stringify({sk:toHex(kp.secretKey),pk:toHex(kp.publicKey)}));})();"
fi

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

# Dynamic env
export MIX_NODE_PUBLIC_KEYS="$(curl -s http://127.0.0.1:4001/health | sed -n 's/.*\"nodePublicKey\":\"\\([^\"]*\\)\".*/\\1/p')"
export DAOMIX_TALLY_SECRET_KEY="$(sed -n 's/.*\"sk\":\"\\([^\"]*\\)\".*/\\1/p' .tmp-tally.json)"
export DAOMIX_TALLY_PUBLIC_KEY="$(sed -n 's/.*\"pk\":\"\\([^\"]*\\)\".*/\\1/p' .tmp-tally.json)"
export DAOMIX_SENDER_SECRET_KEY="$(sed -n 's/.*\"sk\":\"\\([^\"]*\\)\".*/\\1/p' .tmp-sender.json)"
export DAOMIX_SENDER_PUBLIC_KEY="$(sed -n 's/.*\"pk\":\"\\([^\"]*\\)\".*/\\1/p' .tmp-sender.json)"

echo "[E2E] Mix-node: $MIX_NODE_URLS pub=$MIX_NODE_PUBLIC_KEYS"
echo "[E2E] WS: $DAOCHAIN_WS_URL"

npm run test:daochain-e2e --silent


