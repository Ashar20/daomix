#!/bin/bash

# Simple helper to watch all mix-related logs in one terminal

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.demo-logs"

mkdir -p "$LOG_DIR"

echo "=== DaoMix Combined Log Watcher ==="
echo "Tail-following the key demo logs:"
echo "  • Mix Orchestrator"
echo "  • Mix Nodes 1-3"
echo "  • WS Proxies + Transport nodes"
echo "Press Ctrl+C to exit."
echo ""

touch \
  "$LOG_DIR/mix-orchestrator.log" \
  "$LOG_DIR/mixnode-1.log" \
  "$LOG_DIR/mixnode-2.log" \
  "$LOG_DIR/mixnode-3.log" \
  "$LOG_DIR/ws-proxies.log" \
  "$LOG_DIR/transport-entry.log" \
  "$LOG_DIR/transport-middle.log" \
  "$LOG_DIR/transport-exit.log"

tail -F \
  "$LOG_DIR/mix-orchestrator.log" \
  "$LOG_DIR/mixnode-1.log" \
  "$LOG_DIR/mixnode-2.log" \
  "$LOG_DIR/mixnode-3.log" \
  "$LOG_DIR/ws-proxies.log" \
  "$LOG_DIR/transport-entry.log" \
  "$LOG_DIR/transport-middle.log" \
  "$LOG_DIR/transport-exit.log"

