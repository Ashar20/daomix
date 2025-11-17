#!/bin/bash

# Complete test script that starts everything and runs the test
# This script:
# 1. Checks for local Ethereum node (Hardhat or Anvil)
# 2. Deploys the contract if needed
# 3. Starts mix nodes
# 4. Runs the voting test

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🎯 DaoMix Ethereum Contract Voting - Complete Test${NC}"
echo "=================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Check if Hardhat node is running
check_hardhat_node() {
    if curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Start Hardhat node in background
start_hardhat_node() {
    echo -e "${YELLOW}📦 Starting Hardhat node...${NC}"
    cd "$REPO_ROOT/contracts"
    npx hardhat node > /tmp/hardhat-node.log 2>&1 &
    HARDHAT_PID=$!
    
    # Wait for node to be ready
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if check_hardhat_node; then
            echo -e "${GREEN}✅ Hardhat node is running${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    echo -e "${RED}Failed to start Hardhat node${NC}"
    return 1
}

# Deploy contract
deploy_contract() {
    echo -e "${YELLOW}📝 Deploying contract...${NC}"
    cd "$REPO_ROOT/contracts"
    
    # Compile first
    npx hardhat compile
    
    # Deploy
    DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.ts --network localhost 2>&1)
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'DAOMIX_CONTRACT_ADDRESS=\K0x[a-fA-F0-9]+' || echo "")
    
    if [ -z "$CONTRACT_ADDRESS" ]; then
        # Try alternative extraction
        CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'deployed to:\s*\K0x[a-fA-F0-9]+' || echo "")
    fi
    
    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo -e "${RED}Failed to extract contract address from deployment${NC}"
        echo "Deployment output:"
        echo "$DEPLOY_OUTPUT"
        return 1
    fi
    
    export DAOMIX_CONTRACT_ADDRESS="$CONTRACT_ADDRESS"
    echo -e "${GREEN}✅ Contract deployed to: ${CONTRACT_ADDRESS}${NC}"
    echo ""
    return 0
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    [ -n "$HARDHAT_PID" ] && kill $HARDHAT_PID 2>/dev/null || true
    [ -n "$MIX_NODE_1_PID" ] && kill $MIX_NODE_1_PID 2>/dev/null || true
    [ -n "$MIX_NODE_2_PID" ] && kill $MIX_NODE_2_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT

# Step 1: Check/start Ethereum node
if check_hardhat_node; then
    echo -e "${GREEN}✅ Hardhat node is already running${NC}"
else
    start_hardhat_node || exit 1
fi

# Step 2: Deploy contract if address not set
if [ -z "$DAOMIX_CONTRACT_ADDRESS" ]; then
    deploy_contract || exit 1
else
    echo -e "${GREEN}✅ Using existing contract: ${DAOMIX_CONTRACT_ADDRESS}${NC}"
fi

# Step 3: Set default keys if not provided
if [ -z "$DAOMIX_ADMIN_PRIVATE_KEY" ]; then
    # Use Hardhat default account #0
    export DAOMIX_ADMIN_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo -e "${YELLOW}⚠️  Using Hardhat default admin key (for testing only)${NC}"
fi

if [ -z "$DAOMIX_VOTER_PRIVATE_KEYS" ]; then
    # Use Hardhat default accounts #1, #2, #3
    export DAOMIX_VOTER_PRIVATE_KEYS="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
    export DAOMIX_VOTER_VOTES="${DAOMIX_VOTER_VOTES:-ALICE,BOB,ALICE}"
    echo -e "${YELLOW}⚠️  Using Hardhat default voter keys (for testing only)${NC}"
fi

# Step 4: Generate onion keys if not set
if [ -z "$DAOMIX_TALLY_PUBLIC_KEY" ] || [ -z "$DAOMIX_SENDER_PUBLIC_KEY" ]; then
    echo -e "${YELLOW}⚠️  Generating onion encryption keys...${NC}"
    cd "$REPO_ROOT/mixer"
    node -e "
    const sodium = require('libsodium-wrappers');
    (async () => {
        await sodium.ready;
        const tally = sodium.crypto_box_keypair();
        const sender = sodium.crypto_box_keypair();
        console.log('export DAOMIX_TALLY_PUBLIC_KEY=' + '0x' + Buffer.from(tally.publicKey).toString('hex'));
        console.log('export DAOMIX_TALLY_SECRET_KEY=' + '0x' + Buffer.from(tally.privateKey).toString('hex'));
        console.log('export DAOMIX_SENDER_PUBLIC_KEY=' + '0x' + Buffer.from(sender.publicKey).toString('hex'));
        console.log('export DAOMIX_SENDER_SECRET_KEY=' + '0x' + Buffer.from(sender.privateKey).toString('hex'));
    })();
    " > /tmp/keys.sh
    source /tmp/keys.sh
    echo -e "${GREEN}✅ Generated onion encryption keys${NC}"
fi

# Step 5: Start mix nodes
echo -e "${YELLOW}📦 Starting mix nodes...${NC}"
cd "$REPO_ROOT/mixer"

MIX_NODE_PORT=4001 npm run dev:mix-node --workspace @polokol/mixer > /tmp/mix-node-1.log 2>&1 &
MIX_NODE_1_PID=$!
sleep 3

MIX_NODE_PORT=4002 npm run dev:mix-node --workspace @polokol/mixer > /tmp/mix-node-2.log 2>&1 &
MIX_NODE_2_PID=$!
sleep 3

# Step 6: Get mix node public keys
echo -e "${YELLOW}🔑 Getting mix node public keys...${NC}"
MAX_ATTEMPTS=10
ATTEMPT=0
MIX_NODE_1_PUBKEY=""
MIX_NODE_2_PUBKEY=""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && ([ -z "$MIX_NODE_1_PUBKEY" ] || [ -z "$MIX_NODE_2_PUBKEY" ]); do
    if [ -z "$MIX_NODE_1_PUBKEY" ]; then
        RESPONSE=$(curl -s http://127.0.0.1:4001/health 2>/dev/null || echo "")
        if [ -n "$RESPONSE" ]; then
            MIX_NODE_1_PUBKEY=$(echo "$RESPONSE" | grep -o '"nodePublicKey":"[^"]*"' | cut -d'"' -f4 || echo "$RESPONSE" | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4 || echo "")
        fi
    fi
    
    if [ -z "$MIX_NODE_2_PUBKEY" ]; then
        RESPONSE=$(curl -s http://127.0.0.1:4002/health 2>/dev/null || echo "")
        if [ -n "$RESPONSE" ]; then
            MIX_NODE_2_PUBKEY=$(echo "$RESPONSE" | grep -o '"nodePublicKey":"[^"]*"' | cut -d'"' -f4 || echo "$RESPONSE" | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4 || echo "")
        fi
    fi
    
    if [ -z "$MIX_NODE_1_PUBKEY" ] || [ -z "$MIX_NODE_2_PUBKEY" ]; then
        ATTEMPT=$((ATTEMPT + 1))
        sleep 1
    fi
done

if [ -z "$MIX_NODE_1_PUBKEY" ] || [ -z "$MIX_NODE_2_PUBKEY" ]; then
    echo -e "${RED}Failed to get mix node public keys${NC}"
    echo "Mix node 1 log:"
    tail -20 /tmp/mix-node-1.log
    echo "Mix node 2 log:"
    tail -20 /tmp/mix-node-2.log
    exit 1
fi

export MIX_NODE_URLS="http://127.0.0.1:4001,http://127.0.0.1:4002"
export MIX_NODE_PUBLIC_KEYS="${MIX_NODE_1_PUBKEY},${MIX_NODE_2_PUBKEY}"
export DAOMIX_RPC_URL="${DAOMIX_RPC_URL:-http://127.0.0.1:8545}"
export DAOMIX_SHARD_COUNT="${DAOMIX_SHARD_COUNT:-3}"

echo -e "${GREEN}✅ Mix node 1 public key: ${MIX_NODE_1_PUBKEY}${NC}"
echo -e "${GREEN}✅ Mix node 2 public key: ${MIX_NODE_2_PUBKEY}${NC}"
echo ""

# Step 7: Print final configuration
echo -e "${BLUE}📋 Final Configuration:${NC}"
echo "  Contract: ${DAOMIX_CONTRACT_ADDRESS}"
echo "  RPC URL: ${DAOMIX_RPC_URL}"
echo "  Mix Nodes: ${MIX_NODE_URLS}"
echo "  Shard Count: ${DAOMIX_SHARD_COUNT}"
echo "  Voters: $(echo "$DAOMIX_VOTER_PRIVATE_KEYS" | tr ',' '\n' | wc -l)"
echo ""

# Step 8: Run the voting script
echo -e "${GREEN}🚀 Running Ethereum Contract Voting Script...${NC}"
echo ""

cd "$REPO_ROOT/mixer"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Test completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Test failed with exit code ${EXIT_CODE}${NC}"
    echo ""
    echo "Logs available at:"
    echo "  Hardhat node: /tmp/hardhat-node.log"
    echo "  Mix node 1: /tmp/mix-node-1.log"
    echo "  Mix node 2: /tmp/mix-node-2.log"
fi

exit $EXIT_CODE


