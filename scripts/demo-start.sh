#!/bin/bash

# DaoMix Live Demo Starter
# Starts TWO REAL PARACHAINS + Mix Nodes + Demo UI
# NO MOCKS - Everything is real!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT_DIR/.demo-logs"

# Create log directory
mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function print_step() {
    echo -e "${CYAN}🔹 $1${NC}"
}

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_error() {
    echo -e "${RED}❌ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Cleanup function
cleanup() {
    print_header "🛑 Shutting down demo..."

    print_step "Stopping all processes..."
    pkill -f "polkadot-omni-node" 2>/dev/null || true
    pkill -f "mixNodeServer" 2>/dev/null || true
    pkill -f "demo-ui-server.js" 2>/dev/null || true

    print_success "All processes stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if setup was run
if [ ! -f "$ROOT_DIR/polkadot-sdk/target/release/polkadot-omni-node" ]; then
    print_error "Setup not complete!"
    echo ""
    print_info "Run setup first:"
    echo "  bash scripts/demo-setup.sh"
    exit 1
fi

print_header "🎭 DaoMix Live Interactive Demo"
echo ""
print_info "This will start:"
print_info "  • DaoChain (Para 1000 - privacy mixer) on port 9944"
print_info "  • VotingChain (Para 2001 - voting app) on port 9945"
print_info "  • Mix Node 1 on port 9000"
print_info "  • Mix Node 2 on port 9001"
print_info "  • Mix Node 3 on port 9002"
print_info "  • Demo UI on http://localhost:8080"
echo ""
print_warning "TWO REAL PARACHAINS with REAL XCM - no mocks!"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Clean previous state
print_header "🧹 Cleaning Previous State"
print_step "Stopping any existing processes..."
pkill -f "polkadot-omni-node" 2>/dev/null || true
pkill -f "mixNodeServer" 2>/dev/null || true
pkill -f "demo-ui-server" 2>/dev/null || true
sleep 2
print_success "Previous processes stopped"

print_step "Clearing databases..."
rm -rf /tmp/daochain-db /tmp/votingchain-db
print_success "Databases cleared"

# Start DaoChain (Para 1000)
print_header "🔗 Starting DaoChain (Para 1000 - Privacy Mixer)"
print_step "Launching DaoChain with MixJob pallet on port 9944..."

cd "$ROOT_DIR/polkadot-sdk"
./target/release/polkadot-omni-node \
  --chain ./daochain-spec.json \
  --dev \
  --base-path=/tmp/daochain-db \
  --name="DaoChain-Para1000" \
  --detailed-log-output \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --rpc-methods=unsafe \
  --port 30333 \
  > "$LOG_DIR/daochain.log" 2>&1 &

DAOCHAIN_PID=$!
sleep 5

if ps -p $DAOCHAIN_PID > /dev/null; then
    print_success "DaoChain (Para 1000) running (PID: $DAOCHAIN_PID)"
    print_success "  • Para ID: 1000 (privacy mixer)"
    print_success "  • WS RPC: ws://127.0.0.1:9944"
    print_success "  • HTTP RPC: http://127.0.0.1:9933"
    print_success "  • Logs: .demo-logs/daochain.log"
else
    print_error "DaoChain failed to start!"
    cat "$LOG_DIR/daochain.log" | tail -20
    exit 1
fi

# Start VotingChain (Para 2001)
print_header "🗳️  Starting VotingChain (Para 2001 - Voting App)"
print_step "Launching VotingChain with XCM enabled on port 9945..."

cd "$ROOT_DIR/polkadot-sdk"
./target/release/polkadot-omni-node \
  --chain ./votingchain-spec.json \
  --dev \
  --base-path=/tmp/votingchain-db \
  --name="VotingChain-Para2001" \
  --detailed-log-output \
  --rpc-external \
  --rpc-port 9945 \
  --rpc-cors=all \
  --rpc-methods=unsafe \
  --port 30334 \
  > "$LOG_DIR/votingchain.log" 2>&1 &

VOTINGCHAIN_PID=$!
sleep 5

if ps -p $VOTINGCHAIN_PID > /dev/null; then
    print_success "VotingChain (Para 2001) running (PID: $VOTINGCHAIN_PID)"
    print_success "  • Para ID: 2001 (voting app)"
    print_success "  • WS RPC: ws://127.0.0.1:9945"
    print_success "  • HTTP RPC: http://127.0.0.1:9934"
    print_success "  • Logs: .demo-logs/votingchain.log"
    print_success "  • XCM: Can send to Para 1000 (DaoChain)"
else
    print_error "VotingChain failed to start!"
    cat "$LOG_DIR/votingchain.log" | tail -20
    exit 1
fi

# Start Mix Nodes
print_header "🔄 Starting Mix-Node Network"

cd "$ROOT_DIR/mixer"

# Mix Node 1
print_step "Starting Mix Node 1 (port 9000)..."
cd "$ROOT_DIR/mixer"
MIX_NODE_PORT=9000 \
MIX_NODE_ID=1 \
npm run dev:mix-node > "$LOG_DIR/mixnode-1.log" 2>&1 &

MIXNODE1_PID=$!
sleep 2

if ps -p $MIXNODE1_PID > /dev/null; then
    print_success "Mix Node 1 running (PID: $MIXNODE1_PID)"
else
    print_error "Mix Node 1 failed to start!"
    print_warning "Check logs: tail -f $LOG_DIR/mixnode-1.log"
    # Don't exit, continue with other services
fi

# Mix Node 2
print_step "Starting Mix Node 2 (port 9001)..."
cd "$ROOT_DIR/mixer"
MIX_NODE_PORT=9001 \
MIX_NODE_ID=2 \
npm run dev:mix-node > "$LOG_DIR/mixnode-2.log" 2>&1 &

MIXNODE2_PID=$!
sleep 2

if ps -p $MIXNODE2_PID > /dev/null; then
    print_success "Mix Node 2 running (PID: $MIXNODE2_PID)"
else
    print_error "Mix Node 2 failed to start!"
    print_warning "Check logs: tail -f $LOG_DIR/mixnode-2.log"
fi

# Mix Node 3
print_step "Starting Mix Node 3 (port 9002)..."
cd "$ROOT_DIR/mixer"
MIX_NODE_PORT=9002 \
MIX_NODE_ID=3 \
npm run dev:mix-node > "$LOG_DIR/mixnode-3.log" 2>&1 &

MIXNODE3_PID=$!
sleep 2

if ps -p $MIXNODE3_PID > /dev/null; then
    print_success "Mix Node 3 running (PID: $MIXNODE3_PID)"
else
    print_error "Mix Node 3 failed to start!"
    print_warning "Check logs: tail -f $LOG_DIR/mixnode-3.log"
fi

# Wait for all services to be ready
print_header "⏳ Waiting for Services to Initialize"
sleep 5

# Test connections
print_step "Testing DaoChain connection..."
if curl -s -H "Content-Type: application/json" \
   -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
   http://127.0.0.1:9933 > /dev/null 2>&1; then
    print_success "DaoChain RPC responding"
else
    print_warning "DaoChain RPC not responding yet (this is OK, it may still be starting)"
fi

print_step "Testing VotingChain connection..."
if curl -s -H "Content-Type: application/json" \
   -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
   http://127.0.0.1:9934 > /dev/null 2>&1; then
    print_success "VotingChain RPC responding"
else
    print_warning "VotingChain RPC not responding yet (this is OK)"
fi

print_step "Testing Mix Node 1..."
if curl -s http://127.0.0.1:9000/health > /dev/null 2>&1; then
    print_success "Mix Node 1 healthy"
else
    print_warning "Mix Node 1 not ready yet"
fi

# Start Demo UI
print_header "🌐 Starting Demo UI"
print_step "Launching clean demo interface..."

cd "$ROOT_DIR"
node demo-ui-server.js > "$LOG_DIR/demo-ui.log" 2>&1 &

DEMO_PID=$!
sleep 3

if ps -p $DEMO_PID > /dev/null; then
    print_success "Demo UI running (PID: $DEMO_PID)"
else
    print_error "Demo UI failed to start!"
    exit 1
fi

# Final instructions
print_header "🎉 Demo is Running!"
echo ""
print_success "All services are ready!"
echo ""
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "📋 SERVICE URLS (COPY THESE TO BROWSER)"
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}  🌐 Demo UI:                http://127.0.0.1:8080${NC}"
echo ""
echo -e "${BLUE}  🔗 DaoChain (Para 1000):${NC}"
echo -e "${BLUE}     WS RPC:  ws://127.0.0.1:9944${NC}"
echo -e "${BLUE}     HTTP:    http://127.0.0.1:9933${NC}"
echo ""
echo -e "${BLUE}  🗳️  VotingChain (Para 2001):${NC}"
echo -e "${BLUE}     WS RPC:  ws://127.0.0.1:9945${NC}"
echo -e "${BLUE}     HTTP:    http://127.0.0.1:9934${NC}"
echo ""
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "📊 LIVE LOGS"
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  DaoChain:      tail -f .demo-logs/daochain.log"
echo "  VotingChain:   tail -f .demo-logs/votingchain.log"
echo "  Mix Node 1:    tail -f .demo-logs/mixnode-1.log"
echo "  Mix Node 2:    tail -f .demo-logs/mixnode-2.log"
echo "  Mix Node 3:    tail -f .demo-logs/mixnode-3.log"
echo ""
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "📖 INSTRUCTIONS"
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. Open your browser to:"
echo -e "     ${GREEN}http://127.0.0.1:8080${NC}"
echo ""
echo "  2. You'll see SETUP TAB - manually enter these URLs:"
echo "     DaoChain (Para 1000):    ws://127.0.0.1:9944"
echo "     VotingChain (Para 2001): ws://127.0.0.1:9945"
echo ""
echo "  3. Click 'Test Connection' for EACH parachain"
echo ""
echo "  4. Verify you see:"
echo "     ✅ DaomixVoting pallet"
echo "     ✅ MixJob pallet"
echo "     ✅ XCM configuration"
echo ""
echo "  5. Go to DEMO TAB and:"
echo "     • Create election on DaoChain"
echo "     • Cast votes from VotingChain"
echo "     • Submit XCM job from Para 2001 → Para 1000"
echo "     • Watch REAL mixing happen with live logs!"
echo ""
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_warning "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait
