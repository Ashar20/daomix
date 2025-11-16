# 🚀 DaoMix Demo - Quick Start

## Two Commands, Real Blockchains

This is a **100% REAL demo** - no mocks, no simulations.

You will run **TWO REAL Substrate parachains** with **REAL XCM** cross-chain messaging.

---

## Step 1: Setup (First Time Only)

```bash
npm run demo:setup
```

⏱️  **Takes**: 5-10 minutes
✅ **Does**: Fixes dependencies, builds runtime, generates chain specs for 2 parachains

---

## Step 2: Start Demo (Every Time)

```bash
npm run demo:start
```

⏱️  **Takes**: 30 seconds
✅ **Starts**: 2 parachains + 3 mix nodes + UI

---

## Step 3: Open Browser

The terminal will show:

```
🌐 Demo UI:                http://127.0.0.1:8080

🔗 DaoChain (Para 1000):
   WS RPC:  ws://127.0.0.1:9944

🗳️  VotingChain (Para 2001):
   WS RPC:  ws://127.0.0.1:9945
```

**Open** http://127.0.0.1:8080 in your browser.

You'll see a clean, professional interface with:
- **Step 1**: Shows the terminal command (`npm run demo:start`)
- **Step 2**: Example RPC URLs you'll see in your terminal
- **Step 3**: Input boxes for manual RPC entry

---

## Step 4: Manual RPC Entry

In the browser, you'll see **SETUP TAB** with input boxes.

**Manually type or paste** the RPC URLs from the terminal:
- DaoChain: `ws://127.0.0.1:9944`
- VotingChain: `ws://127.0.0.1:9945`

Click **"Test Connection"** for each.

---

## Step 5: Experience Real Cross-Chain Privacy

Go to **DEMO TAB** and:
1. Create election on DaoChain
2. Cast votes from VotingChain
3. Submit XCM job (Para 2001 → Para 1000)
4. Watch REAL mixing with live logs!

---

## What Makes This Real?

✅ **2 actual Substrate nodes** (not simulated)
✅ **Real XCM V4 messages** (cross-chain communication)
✅ **Real mix nodes** (HTTP servers with cryptography)
✅ **Real on-chain storage** (blockchain state)
✅ **Real logs** (from actual processes)

---

## Stop Demo

Press `Ctrl+C` in the terminal.

---

## Full Documentation

📖 [DEMO_COMPLETE.md](DEMO_COMPLETE.md) - Complete guide with detailed explanations
🔧 [DEMO_IMPLEMENTATION_SUMMARY.md](DEMO_IMPLEMENTATION_SUMMARY.md) - Technical summary
📚 [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - All documentation

---

## Troubleshooting

**Port conflict?**
```bash
pkill -f "polkadot-omni-node"
npm run demo:start
```

**Chain specs missing?**
```bash
npm run demo:setup
```

**Connection failed?**
- Wait 10 seconds for nodes to start
- Check `.demo-logs/daochain.log`

---

## That's It!

Two commands, real blockchains, real privacy. 🔒🌐

**NO MOCKS. NO SIMULATIONS. 100% REAL.**
