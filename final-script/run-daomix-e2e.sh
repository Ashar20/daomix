#!/usr/bin/env bash

set -euo pipefail

# ------------------------------------------------------------------------------
# DaoMix + DaoChain – Final End-to-End Test Runner
#
# This script:
#   1) Builds @polokol/mixer
#   2) Runs the DaoMix → DaoChain pipeline
#
# It assumes:
#   - You are in the DaoMix repo root (where package.json lives).
#   - DaoChain node is already running and reachable.
#   - Mix nodes and transport nodes are already running.
#   - All required environment variables are set (see final-script/README.md).
# ------------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==[ DaoMix E2E ]======================================================="
echo "Repo root:         $REPO_ROOT"
echo "Using Node:        $(node -v || echo 'node not found')"
echo "Using npm:         $(npm -v || echo 'npm not found')"
echo "======================================================================="

# --- Basic env sanity checks -----------------------------------------------

required_env=(
  DAOCHAIN_WS_URL
  DAOCHAIN_ADMIN_SEED
  DAOCHAIN_TALLY_SEED
  DAOCHAIN_VOTER_SEEDS
  DAOCHAIN_VOTER_VOTES
  DAOCHAIN_ELECTION_ID
)

echo "[check] Validating required environment variables..."
for var in "${required_env[@]}"; do
  if [[ -z "${!var-}" ]]; then
    echo "ERROR: Environment variable '$var' is not set."
    echo "       Please see final-script/README.md for setup instructions."
    exit 1
  fi
done
echo "[ok]   Core DaoChain env vars present."

# Optional but recommended:
if [[ "${DAOCHAIN_TRANSPORT_ENABLED-}" == "true" ]]; then
  echo "[info] Transport mix is ENABLED. Checking transport-related env vars..."

  transport_env=(
    DAOCHAIN_TRANSPORT_ENTRY_URL
    DAOCHAIN_TRANSPORT_NODE_URLS
    DAOCHAIN_TRANSPORT_NODE_PUBKEYS
  )

  for var in "${transport_env[@]}"; do
    if [[ -z "${!var-}" ]]; then
      echo "ERROR: Transport is enabled, but '$var' is not set."
      echo "       Either set all required transport vars or disable transport:"
      echo "       export DAOCHAIN_TRANSPORT_ENABLED=false"
      exit 1
    fi
  done
  echo "[ok]   Transport env vars present."
else
  echo "[info] Transport mix is DISABLED or not set. Pipeline will use direct RPC."
fi

echo "======================================================================="
echo "[step] Building @polokol/mixer..."
cd "$REPO_ROOT"

npm run build --workspace @polokol/mixer

echo "======================================================================="
echo "[step] Running DaoMix → DaoChain pipeline..."
echo "       (this may take a few blocks to finalize deadlines and tally)"

# Use the transport-enabled convenience script if you prefer,
# otherwise call the generic runner. This assumes you added:
#   "run:daochain-pipeline-transport": "ts-node src/runDaoMixDaoChain.ts --transport"
# or similar in @polokol/mixer/package.json. If not, call the plain script.

if [[ "${DAOCHAIN_TRANSPORT_ENABLED-}" == "true" ]]; then
  echo "[info] Using transport-enabled pipeline script..."
  npm run run:daochain-pipeline-transport --workspace @polokol/mixer
else
  echo "[info] Using direct RPC pipeline script..."
  npm run run:daochain-pipeline --workspace @polokol/mixer
fi

echo "======================================================================="
echo "[done] DaoMix E2E pipeline finished."
echo "       Now you can:"
echo "         - Inspect events/extrinsics in Polkadot.js Apps"
echo "         - Check DaomixVoting storage (Elections, BallotCount, TallyResults)"
echo "======================================================================="



