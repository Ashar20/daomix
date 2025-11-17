#!/bin/bash

# Test Transport Mix Demo
# This script simulates what happens when a user creates an election in the browser

echo "🧪 Testing Transport Mix with Browser-Style Transaction"
echo ""
echo "This will:"
echo "1. Connect to the WS proxy (like the browser does)"
echo "2. Submit a transaction (like creating an election)"
echo "3. Show you the logs proving it went through 3 hops"
echo ""

# Check if transport nodes are running
echo "📡 Checking transport nodes..."
if ! curl -s http://localhost:9100/health > /dev/null; then
    echo "❌ Entry node (9100) not running!"
    exit 1
fi
if ! curl -s http://localhost:9101/health > /dev/null; then
    echo "❌ Middle node (9101) not running!"
    exit 1
fi
if ! curl -s http://localhost:9102/health > /dev/null; then
    echo "❌ Exit node (9102) not running!"
    exit 1
fi
echo "✅ All transport nodes running"
echo ""

# Check WS proxies
echo "📡 Checking WS proxies..."
if ! lsof -i :9950 > /dev/null 2>&1; then
    echo "❌ DaoChain proxy (9950) not running!"
    exit 1
fi
if ! lsof -i :9951 > /dev/null 2>&1; then
    echo "❌ VotingChain proxy (9951) not running!"
    exit 1
fi
echo "✅ Both WS proxies running"
echo ""

echo "🔍 Now watching proxy logs..."
echo "Open your browser to http://localhost:8080"
echo "Connect to VotingChain and create an election."
echo ""
echo "You should see lines like:"
echo "  [VotingChain] 🔄 Converting author_submitAndWatchExtrinsic to one-shot version"
echo "  [VotingChain] 🔐 author_submitExtrinsic → via transport mix"
echo "  [VotingChain] ✅ author_submitAndWatchExtrinsic → submitted via 3-hop mix"
echo ""
echo "Press Ctrl+C to stop watching."
echo ""

# Watch the logs with color
tail -f .demo-logs/ws-proxies.log | grep --line-buffered -E "(via transport mix|submitted via 3-hop|Converting author)" --color=always

