#!/bin/bash

# Test script for Ethereum Contract Voting
# This script starts all required services and runs the voting test

set -e

echo "🎯 Starting DaoMix Ethereum Contract Voting Test"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: node is not installed${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}Error: npm is not installed${NC}" >&2; exit 1; }

# Get mix node public keys
get_mix_node_pubkey() {
    local port=$1
    local url="http://127.0.0.1:${port}/health"
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            local response=$(curl -s "$url")
            echo "$response" | grep -o '"nodePublicKey":"[^"]*"' | cut -d'"' -f4
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    echo -e "${RED}Failed to get public key from mix node on port ${port}${NC}" >&2
    return 1
}

# Start mix nodes in background
echo -e "${YELLOW}📦 Starting mix nodes...${NC}"
cd "$(dirname "$0")/.."

# Start mix node 1
echo "Starting mix node 1 on port 4001..."
MIX_NODE_PORT=4001 npm run dev:mix-node --workspace @polokol/mixer > /tmp/mix-node-1.log 2>&1 &
MIX_NODE_1_PID=$!
sleep 3

# Start mix node 2
echo "Starting mix node 2 on port 4002..."
MIX_NODE_PORT=4002 npm run dev:mix-node --workspace @polokol/mixer > /tmp/mix-node-2.log 2>&1 &
MIX_NODE_2_PID=$!
sleep 3

# Get public keys
echo -e "${YELLOW}🔑 Getting mix node public keys...${NC}"
MIX_NODE_1_PUBKEY=$(get_mix_node_pubkey 4001)
MIX_NODE_2_PUBKEY=$(get_mix_node_pubkey 4002)

if [ -z "$MIX_NODE_1_PUBKEY" ] || [ -z "$MIX_NODE_2_PUBKEY" ]; then
    echo -e "${RED}Failed to get mix node public keys${NC}"
    kill $MIX_NODE_1_PID $MIX_NODE_2_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Mix node 1 public key: ${MIX_NODE_1_PUBKEY}${NC}"
echo -e "${GREEN}✅ Mix node 2 public key: ${MIX_NODE_2_PUBKEY}${NC}"
echo ""

# Check if we need to generate keys
if [ -z "$DAOMIX_TALLY_PUBLIC_KEY" ] || [ -z "$DAOMIX_SENDER_PUBLIC_KEY" ]; then
    echo -e "${YELLOW}⚠️  Onion encryption keys not set. Generating test keys...${NC}"
    echo "You should set these in your .env file for production use."
    echo ""
    
    # Generate keys using a Node.js script
    cd "$(dirname "$0")/.."
    node -e "
    const sodium = require('libsodium-wrappers');
    (async () => {
        await sodium.ready;
        const tally = sodium.crypto_box_keypair();
        const sender = sodium.crypto_box_keypair();
        console.log('DAOMIX_TALLY_PUBLIC_KEY=' + '0x' + Buffer.from(tally.publicKey).toString('hex'));
        console.log('DAOMIX_TALLY_SECRET_KEY=' + '0x' + Buffer.from(tally.privateKey).toString('hex'));
        console.log('DAOMIX_SENDER_PUBLIC_KEY=' + '0x' + Buffer.from(sender.publicKey).toString('hex'));
        console.log('DAOMIX_SENDER_SECRET_KEY=' + '0x' + Buffer.from(sender.privateKey).toString('hex'));
    })();
    " > /tmp/keys.env
    source /tmp/keys.env
    echo -e "${GREEN}✅ Generated test keys${NC}"
    echo ""
fi

# Set required environment variables if not set
export MIX_NODE_URLS="${MIX_NODE_URLS:-http://127.0.0.1:4001,http://127.0.0.1:4002}"
export MIX_NODE_PUBLIC_KEYS="${MIX_NODE_PUBLIC_KEYS:-${MIX_NODE_1_PUBKEY},${MIX_NODE_2_PUBKEY}}"
export DAOMIX_RPC_URL="${DAOMIX_RPC_URL:-http://127.0.0.1:8545}"
export DAOMIX_SHARD_COUNT="${DAOMIX_SHARD_COUNT:-3}"

# Check if contract address is set
if [ -z "$DAOMIX_CONTRACT_ADDRESS" ]; then
    echo -e "${RED}Error: DAOMIX_CONTRACT_ADDRESS is not set${NC}"
    echo "Please deploy the contract first and set DAOMIX_CONTRACT_ADDRESS"
    echo ""
    echo "To deploy:"
    echo "  cd contracts"
    echo "  npx hardhat compile"
    echo "  npx hardhat run scripts/deploy.ts --network localhost"
    echo ""
    kill $MIX_NODE_1_PID $MIX_NODE_2_PID 2>/dev/null || true
    exit 1
fi

# Check if admin private key is set
if [ -z "$DAOMIX_ADMIN_PRIVATE_KEY" ]; then
    echo -e "${RED}Error: DAOMIX_ADMIN_PRIVATE_KEY is not set${NC}"
    echo "Please set DAOMIX_ADMIN_PRIVATE_KEY in your environment"
    kill $MIX_NODE_1_PID $MIX_NODE_2_PID 2>/dev/null || true
    exit 1
fi

# Check if voter keys are set
if [ -z "$DAOMIX_VOTER_PRIVATE_KEYS" ]; then
    echo -e "${YELLOW}⚠️  DAOMIX_VOTER_PRIVATE_KEYS not set, using test keys...${NC}"
    # Generate test voter keys (for testing only - use real keys in production)
    export DAOMIX_VOTER_PRIVATE_KEYS="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
    export DAOMIX_VOTER_VOTES="${DAOMIX_VOTER_VOTES:-ALICE,BOB,ALICE}"
    echo -e "${GREEN}✅ Using test voter keys${NC}"
    echo ""
fi

# Print configuration
echo -e "${GREEN}📋 Configuration:${NC}"
echo "  Contract: ${DAOMIX_CONTRACT_ADDRESS}"
echo "  RPC URL: ${DAOMIX_RPC_URL}"
echo "  Mix Nodes: ${MIX_NODE_URLS}"
echo "  Shard Count: ${DAOMIX_SHARD_COUNT}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    kill $MIX_NODE_1_PID $MIX_NODE_2_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT

# Run the voting script
echo -e "${GREEN}🚀 Running Ethereum Contract Voting Script...${NC}"
echo ""

npm run run:ethereum-contract-voting --workspace @polokol/mixer

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Test completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Test failed with exit code ${EXIT_CODE}${NC}"
    echo ""
    echo "Mix node logs:"
    echo "  Node 1: /tmp/mix-node-1.log"
    echo "  Node 2: /tmp/mix-node-2.log"
fi

exit $EXIT_CODE

