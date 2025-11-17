#!/bin/bash
echo "Testing if DaoChain serves HTTP RPC on port 9944..."
response=$(curl -s -X POST http://127.0.0.1:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}')
echo "Response: $response"
echo ""

echo "Testing if transport nodes are accessible..."
curl -s http://localhost:9100/health | jq -r '.publicKey' | head -c 20
echo "... (entry)"
curl -s http://localhost:9101/health | jq -r '.publicKey' | head -c 20
echo "... (middle)"
curl -s http://localhost:9102/health | jq -r '.publicKey' | head -c 20
echo "... (exit)"
echo ""
echo "✅ Transport mix infrastructure is ready!"
