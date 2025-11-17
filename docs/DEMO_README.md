# 🎭 DaoMix Live Interactive Demo

**Experience real cross-chain privacy mixing with live blockchain nodes and real-time logs.**

This demo runs **TWO REAL BLOCKCHAINS** (DaoChain + VotingChain) and shows you the complete mixing process happening live in your browser.

## ⚠️ NO MOCKS. NO SIMULATIONS. 100% REAL.

- ✅ **Real Substrate Nodes** - Actual blockchains running locally
- ✅ **Real Mix Nodes** - Live HTTP servers performing cryptographic shuffling
- ✅ **Real XCM Messages** - Cross-chain communication between parachains
- ✅ **Real Encryption** - X25519 + XChaCha20-Poly1305 onion encryption
- ✅ **Real Results** - Verifiable Merkle commitments on-chain

## 🚀 Quick Start (First Time Setup)

### Step 1: One-Command Setup

```bash
# This fixes ALL dependencies and builds everything (5-10 minutes)
bash scripts/demo-setup.sh
```

**What it does:**
- ✅ Fixes schnorrkel dependency conflicts automatically
- ✅ Builds DaoChain runtime with MixJob pallet
- ✅ Builds VotingChain (simulated second parachain)
- ✅ Compiles mix-node network
- ✅ Generates onion encryption keys
- ✅ Verifies all components

### Step 2: Start the Demo

```bash
# Starts both chains, mix nodes, and demo UI
bash scripts/demo-start.sh
```

**What it starts:**
- 🔗 **DaoChain** on `ws://127.0.0.1:9944` (privacy mixer)
- 🗳️ **VotingChain** on `ws://127.0.0.1:9945` (your voting parachain)
- 🔄 **Mix Node 1** on `http://localhost:9000`
- 🔄 **Mix Node 2** on `http://localhost:9001`
- 🔄 **Mix Node 3** on `http://localhost:9002`
- 🌐 **Demo UI** on `http://localhost:8080`

### Step 3: Open Browser

```bash
# The script will show you:
```

```
┌─────────────────────────────────────────────────┐
│  🎉 Demo is Running!                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  📋 COPY THESE URLs:                            │
│                                                 │
│  🌐 Demo UI:         http://127.0.0.1:8080     │
│  🔗 DaoChain RPC:    ws://127.0.0.1:9944       │
│  🗳️  VotingChain RPC: ws://127.0.0.1:9945      │
│                                                 │
│  📖 INSTRUCTIONS:                               │
│  1. Open http://127.0.0.1:8080 in browser      │
│  2. Manually enter RPC URLs from above         │
│  3. Click "Test Connection"                     │
│  4. Follow interactive demo!                    │
│                                                 │
│  Press Ctrl+C to stop all services             │
└─────────────────────────────────────────────────┘
```

## 🌐 Browser Interfaces

### Tab 1: Parachain Interface (Election Creation)
**URL:** `http://127.0.0.1:8080/parachain`
- Create elections
- Cast votes
- See real-time activity logs

### Tab 2: DaoChain Interface (Mixing Monitor)
**URL:** `http://127.0.0.1:8080`
- Monitor mixing process
- Trigger ballot mixing
- View final results
- Real-time logs of all operations

## 🔄 Demo Flow

1. **Start the demo script** - It provides the URLs above
2. **Open both URLs** in separate browser tabs
3. **RPC Connection** - Each tab auto-connects to its blockchain
4. **Create Election** - Use parachain tab to create an election
5. **Cast Votes** - Submit votes from multiple accounts
6. **Trigger Mixing** - Use DaoChain tab to start the privacy mixing
7. **View Results** - See anonymous, verifiable final tally

## 📊 Real-Time Features

### Live Logging
- **Color-coded logs** (info, success, warning, error)
- **Step-by-step explanations** of what's happening
- **Cross-tab synchronization** - actions in one tab appear in both

### Detailed Action Logs
```
🗳️  User initiated election creation from parachain tab
   Election ID: 1
   Start Block: 10, End Block: 100
   → Election created on parachain, now available for voting

🗳️  User cast a vote from parachain tab
   Voter: //Alice
   Vote: YES
   → Vote encrypted with onion layers and submitted to DaoChain
   → Vote will be shuffled through mix nodes for anonymity

🔄 User triggered mixing process from DaoChain tab
   Election ID: 1
   → Sending ballots through mix nodes for shuffling
   → Mix nodes re-encrypting votes to hide patterns
   → Final tally will be computed and committed on-chain
```

## 🏗️ What Gets Started

The demo automatically starts:

- **DaoChain Node** (port 9944) - Privacy blockchain with MixJob pallet
- **Parachain Node** (port 9945) - Regular chain for initiating elections
- **3 Mix Nodes** (ports 4001-4003) - Ballot shuffling servers
- **HTTP Server** (port 8080) - Browser interfaces
- **WebSocket Server** (port 8081) - Real-time log streaming

## 🎯 Manual RPC Entry

Unlike automated demos, this requires **manual RPC URL entry**:

**DaoChain Tab:** Enter `http://127.0.0.1:9933`
**Parachain Tab:** Enter `http://127.0.0.1:9934`

This teaches users about blockchain connections and gives full control.

## 🛑 Stopping the Demo

Press `Ctrl+C` in the terminal - all services shut down cleanly.

## 🔧 Troubleshooting

### Port Conflicts
If ports are in use, the script will show errors. Kill existing processes:
```bash
# Kill any existing node processes
pkill -f "polkadot-omni-node"
pkill -f "mix-node"
```

### Browser Issues
- Make sure both tabs are open
- Check browser console for WebSocket connection errors
- Refresh tabs if logs don't appear

### Build Issues
The script builds components automatically. If you get build errors:
```bash
# Manual build
npm run build --workspace @polokol/mixer
```

## 📈 Advanced Usage

### Custom Configuration
Edit the `CONFIG` object in `demo-manual.js` to change ports or settings.

### Skip Components
```bash
# Skip mix nodes (for faster testing)
node demo-manual.js --no-mix-nodes

# Skip building (if already built)
node demo-manual.js --skip-build
```

### Status API
Check system status: `http://127.0.0.1:8080/status`

## 🎉 What You'll Experience

- **Visual Privacy Flow** - See votes become anonymous through mixing
- **Cross-Chain Communication** - Watch parachain ↔ DaoChain interaction
- **Real-Time Monitoring** - Live updates of every step
- **Educational Logging** - Detailed explanations of cryptography
- **Interactive Control** - Full user control over the process

**This demo transforms complex blockchain privacy into an interactive, educational experience!** 🚀🔒✨

