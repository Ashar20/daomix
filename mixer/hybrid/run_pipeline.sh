#!/usr/bin/env bash

set -euo pipefail

# Get the repo root (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "== DaoMix + DaoChain Hybrid Pipeline =="
echo ""

# 1) Check required env vars
required_env=(
  DAOCHAIN_WS_URL
  DAOCHAIN_ADMIN_SEED
  DAOCHAIN_TALLY_SEED
  DAOCHAIN_VOTER_SEEDS
  DAOCHAIN_VOTER_VOTES
  DAOCHAIN_ELECTION_ID
  MIX_NODE_URLS
  MIX_NODE_PUBLIC_KEYS
)

echo "[*] Checking required environment variables..."
missing=false
for v in "${required_env[@]}"; do
  if [ -z "${!v-}" ]; then
    echo "  - MISSING: $v"
    missing=true
  else
    # Truncate long values for readability
    val="${!v}"
    if [ ${#val} -gt 60 ]; then
      val="${val:0:57}..."
    fi
    echo "  ✓ $v=$val"
  fi
done

if [ "$missing" = true ]; then
  echo ""
  echo "[-] One or more required env vars are missing."
  echo "    Copy .env.example to .env, fill it in, and 'source' it before running:"
  echo "    $ cd $SCRIPT_DIR"
  echo "    $ cp .env.example .env"
  echo "    $ # Edit .env, then:"
  echo "    $ source .env"
  exit 1
fi

echo ""

# 2) Check DaoChain connectivity
echo "[*] Checking DaoChain HTTP connectivity: ${DAOCHAIN_HTTP_URL:-not set}"
if [ -z "${DAOCHAIN_HTTP_URL-}" ]; then
  echo "[-] DAOCHAIN_HTTP_URL is not set"
  exit 1
fi

if ! curl -s --max-time 2 "$DAOCHAIN_HTTP_URL" >/dev/null 2>&1; then
  echo "[-] Cannot reach DaoChain HTTP RPC at $DAOCHAIN_HTTP_URL"
  echo "    Make sure 'polkadot-omni-node --chain ./chain_spec.json --dev' is running."
  exit 1
fi

echo "[+] DaoChain HTTP is reachable."
echo ""

# 3) Check optional PQ mode
if [ "${DAOMIX_PQ_ENABLED:-false}" = "true" ]; then
  echo "[*] Post-quantum hybrid mode: ENABLED"
  if [ -z "${MIX_NODE_PQ_PUBLIC_KEYS:-}" ]; then
    echo "    ⚠ Warning: PQ enabled but MIX_NODE_PQ_PUBLIC_KEYS not set (will fall back to classical for ballot mix)"
  fi
  if [ -z "${DAOCHAIN_TRANSPORT_NODE_PQ_PUBKEYS:-}" ] && [ "${DAOCHAIN_TRANSPORT_ENABLED:-false}" = "true" ]; then
    echo "    ⚠ Warning: PQ enabled but DAOCHAIN_TRANSPORT_NODE_PQ_PUBKEYS not set (will fall back to classical for transport)"
  fi
else
  echo "[*] Post-quantum hybrid mode: DISABLED (classical X25519 only)"
fi
echo ""

# 4) Check optional transport mix
if [ "${DAOCHAIN_TRANSPORT_ENABLED:-false}" = "true" ]; then
  echo "[*] Transport mix: ENABLED"
else
  echo "[*] Transport mix: DISABLED (direct RPC)"
fi
echo ""

# 5) Build TypeScript
echo "[*] Building @polokol/mixer (tsc)..."
if ! (cd "$ROOT_DIR" && npm run build --workspace @polokol/mixer) >/dev/null 2>&1; then
  echo "[-] Build failed. Check output above."
  exit 1
fi
echo "[+] Build OK."
echo ""

# 6) Run the pipeline
echo "[*] Running DaoMix pipeline against DaoChain..."
echo "    (this will create election if needed, register voters,"
echo "     cast onion ballots, run mix+shard, decrypt, and submit tally)"
echo ""

# Change to root directory and run the pipeline
cd "$ROOT_DIR"
LOG_FILE="$SCRIPT_DIR/pipeline.log"

# Export all env vars explicitly to ensure they're available to the Node process
export DAOCHAIN_WS_URL
export DAOCHAIN_HTTP_URL
export DAOCHAIN_ADMIN_SEED
export DAOCHAIN_TALLY_SEED
export DAOCHAIN_VOTER_SEEDS
export DAOCHAIN_VOTER_VOTES
export DAOCHAIN_ELECTION_ID
export DAOCHAIN_REG_DEADLINE_OFFSET
export DAOCHAIN_VOTE_DEADLINE_OFFSET
export MIX_NODE_URLS
export MIX_NODE_PUBLIC_KEYS
export MIX_NODE_PQ_PUBLIC_KEYS
export DAOMIX_SHARD_COUNT
export DAOMIX_PQ_ENABLED
export DAOCHAIN_TRANSPORT_ENABLED
export DAOCHAIN_TRANSPORT_ENTRY_URL
export DAOCHAIN_TRANSPORT_NODE_URLS
export DAOCHAIN_TRANSPORT_NODE_PUBKEYS
export DAOCHAIN_TRANSPORT_NODE_PQ_PUBKEYS
export DAOCHAIN_TRANSPORT_SENDER_SK

# Run the TypeScript pipeline (using ts-node since the built JS might need runtime deps)
if ! TS_NODE_FILES=true npx ts-node --project mixer/tsconfig.json mixer/src/runDaoMixDaoChain.ts 2>&1 | tee "$LOG_FILE"; then
  status=$?
  echo ""
  echo "[-] Pipeline failed with exit code $status."
  echo "    Check '$LOG_FILE' for details."
  exit "$status"
fi

echo ""
echo "[+] Pipeline completed successfully."
echo ""
echo "    Check '$LOG_FILE' for:"
echo "      - 'Created election' or 'Election already exists'"
echo "      - 'Registered voter' lines"
echo "      - 'Cast onion ballots' lines"
echo "      - 'Decrypted votes' and tally output"
echo "      - 'setMixCommitments' and 'submitTally' transaction hashes"
echo ""
echo "    You can now open Polkadot.js Apps, connect to ${DAOCHAIN_WS_URL},"
echo "    and inspect 'daomixVoting' storage for electionId=${DAOCHAIN_ELECTION_ID}."

