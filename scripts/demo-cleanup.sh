#!/bin/bash

# DaoMix Demo Cleanup Script
# Use this if demo-start.sh didn't shut down cleanly
# or if you need to manually kill all demo processes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function print_step() {
    echo -e "${BLUE}🔹 $1${NC}"
}

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to kill process on port
kill_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}  • Killing $name on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 0.5
        return 0
    else
        echo -e "${GREEN}  ✓ Port $port is free ($name)${NC}"
        return 1
    fi
}

print_header "🧹 DaoMix Demo Cleanup"
echo ""
print_warning "This will kill ALL demo-related processes"
echo ""

# Kill by process name
print_step "Killing processes by name..."
KILLED=0

if pkill -f "polkadot-omni-node" 2>/dev/null; then
    echo "  • Killed polkadot-omni-node processes"
    KILLED=$((KILLED + 1))
fi

if pkill -f "mixNodeServer" 2>/dev/null; then
    echo "  • Killed mixNodeServer processes"
    KILLED=$((KILLED + 1))
fi

if pkill -f "mix-node" 2>/dev/null; then
    echo "  • Killed mix-node processes"
    KILLED=$((KILLED + 1))
fi

if pkill -f "demo-ui-server" 2>/dev/null; then
    echo "  • Killed demo-ui-server processes"
    KILLED=$((KILLED + 1))
fi

if pkill -f "transportNodeServer" 2>/dev/null; then
    echo "  • Killed transportNodeServer processes"
    KILLED=$((KILLED + 1))
fi

if pkill -f "wsProxyLauncher" 2>/dev/null; then
    echo "  • Killed wsProxyLauncher processes"
    KILLED=$((KILLED + 1))
fi

if [ $KILLED -eq 0 ]; then
    print_success "No processes found by name"
else
    print_success "Killed $KILLED process types"
fi

sleep 2
echo ""

# Kill by port
print_step "Checking and cleaning ports..."
PORT_KILLS=0

kill_port 9944 "DaoChain RPC" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9945 "VotingChain RPC" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9933 "DaoChain HTTP" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9934 "VotingChain HTTP" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 30333 "DaoChain P2P" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 30334 "VotingChain P2P" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9000 "Mix Node 1" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9001 "Mix Node 2" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9002 "Mix Node 3" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9100 "Transport Entry" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9101 "Transport Middle" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9102 "Transport Exit" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9950 "WS Proxy DaoChain" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 9951 "WS Proxy VotingChain" && PORT_KILLS=$((PORT_KILLS + 1))
kill_port 8080 "Demo UI" && PORT_KILLS=$((PORT_KILLS + 1))

if [ $PORT_KILLS -eq 0 ]; then
    print_success "All ports are free!"
else
    print_success "Freed $PORT_KILLS ports"
fi

echo ""

# Clean databases
print_step "Cleaning databases..."
if [ -d "/tmp/daochain-db" ] || [ -d "/tmp/votingchain-db" ]; then
    rm -rf /tmp/daochain-db /tmp/votingchain-db 2>/dev/null || true
    print_success "Databases cleared"
else
    print_success "No databases to clean"
fi

echo ""

# Clean log files (optional)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT_DIR/.demo-logs"

if [ -d "$LOG_DIR" ]; then
    echo -e "${YELLOW}Log files found in $LOG_DIR${NC}"
    read -p "Do you want to delete log files? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$LOG_DIR"
        mkdir -p "$LOG_DIR"
        print_success "Log files cleared"
    else
        print_warning "Log files kept"
    fi
fi

echo ""
print_header "✅ Cleanup Complete!"
echo ""
print_success "All demo processes stopped"
print_success "All ports freed"
print_success "Ready to run demo again"
echo ""
echo "To start the demo:"
echo "  bash scripts/demo-start.sh"
echo ""

