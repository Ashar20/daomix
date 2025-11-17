#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/silas/daomix"
SDK="$ROOT/polkadot-sdk"
MIX="$ROOT/mixer"

echo "[1/6] Starting omni-node (relay+parachain)…"
cd "$SDK"

# Build omni-node if missing
if [ ! -x ./target/release/polkadot-omni-node ]; then
  echo "  - Building polkadot-omni-node (first time only)…"
  cargo build -p polkadot-omni-node --release
fi

# You must have a chain spec json; if you don't yet, generate it per your DaoChain README.
if [ ! -f ./chain_spec.json ]; then
  echo "❌ Missing chain_spec.json in $SDK. Generate it with chain-spec-builder per DaoChain README, then rerun."
  exit 1
fi

# Kill any previous instance listening on ports
pkill -f polkadot-omni-node || true
sleep 1

# Start omni-node JSON-RPC on 9944 (serves both HTTP & WS on this port)
RUST_LOG=runtime=debug RUST_BACKTRACE=1 ./target/release/polkadot-omni-node \
  --chain ./chain_spec.json \
  --dev \
  --detailed-log-output \
  --rpc-external \
  --rpc-port 9944 \
  > "$ROOT/.tmp-daomix-omni.log" 2>&1 &

OMNI_PID=$!
echo "  - omni-node PID: $OMNI_PID"

echo "[2/6] Wait briefly for RPC server (on 9944)…"
sleep 4

echo "[3/6] Start mix-node…"
cd "$MIX"
pkill -f mixNodeServer.ts || true
sleep 1
TS_NODE_FILES=true npx ts-node src/mixNodeServer.ts > "$ROOT/.tmp-daomix-mixnode.log" 2>&1 &
MIX_PID=$!
echo "  - mix-node PID: $MIX_PID"

echo "  - Wait for mix-node /health…"
for i in {1..30}; do
  if curl -s http://127.0.0.1:4001/health >/dev/null; then
    break
  fi
  sleep 1
done
MIX_NODE_PUB=$(curl -s http://127.0.0.1:4001/health | sed -n 's/.*"nodePublicKey":"\([^"]*\)".*/\1/p')
if [ -z "$MIX_NODE_PUB" ]; then
  echo "❌ Could not read mix-node public key. See $ROOT/.tmp-daomix-mixnode.log"
  kill $MIX_PID || true
  kill $OMNI_PID || true
  exit 1
fi
echo "  - mix-node pub: $MIX_NODE_PUB"

echo "[4/6] Generate tally/sender keys…"
TS_NODE_FILES=true npx ts-node -e "const {generateKeypair,toHex,initCrypto}=require('./src/crypto');(async()=>{await initCrypto();const kp=generateKeypair();require('fs').writeFileSync('.tmp-tally.json',JSON.stringify({sk:toHex(kp.secretKey),pk:toHex(kp.publicKey)}));})();"
TS_NODE_FILES=true npx ts-node -e "const {generateKeypair,toHex,initCrypto}=require('./src/crypto');(async()=>{await initCrypto();const kp=generateKeypair();require('fs').writeFileSync('.tmp-sender.json',JSON.stringify({sk:toHex(kp.secretKey),pk:toHex(kp.publicKey)}));})();"

TALLY_PK=$(sed -n 's/.*"pk":"\([^"]*\)".*/\1/p' .tmp-tally.json)
TALLY_SK=$(sed -n 's/.*"sk":"\([^"]*\)".*/\1/p' .tmp-tally.json)
SENDER_PK=$(sed -n 's/.*"pk":"\([^"]*\)".*/\1/p' .tmp-sender.json)
SENDER_SK=$(sed -n 's/.*"sk":"\([^"]*\)".*/\1/p' .tmp-sender.json)

echo "[5/6] Run DaoChain E2E test…"
DAOCHAIN_WS_URL=ws://127.0.0.1:9944 \
DAOCHAIN_HTTP_URL=http://127.0.0.1:9944 \
DAOCHAIN_ADMIN_SEED=//Alice \
DAOCHAIN_TALLY_SEED=//Alice \
DAOCHAIN_VOTER_SEEDS="//Bob,//Charlie,//Dave" \
DAOCHAIN_VOTER_VOTES="ALICE,BOB,ALICE" \
DAOCHAIN_ELECTION_ID=42 \
DAOCHAIN_TRANSPORT_ENABLED=false \
MIX_NODE_URLS="http://127.0.0.1:4001" \
MIX_NODE_PUBLIC_KEYS="$MIX_NODE_PUB" \
DAOMIX_TALLY_SECRET_KEY="$TALLY_SK" \
DAOMIX_TALLY_PUBLIC_KEY="$TALLY_PK" \
DAOMIX_SENDER_SECRET_KEY="$SENDER_SK" \
DAOMIX_SENDER_PUBLIC_KEY="$SENDER_PK" \
npm run test:daochain-e2e --silent || TEST_FAIL=1

echo "[6/6] Summary:"
if [ "${TEST_FAIL:-0}" = "1" ]; then
  echo "❌ E2E FAILED"
  echo "  - Check logs:"
  echo "    • omni: $ROOT/.tmp-daomix-omni.log"
  echo "    • mix : $ROOT/.tmp-daomix-mixnode.log"
  exit 1
else
  echo "✅ E2E PASSED: pallet present, ballots cast, tally stored"
fi


