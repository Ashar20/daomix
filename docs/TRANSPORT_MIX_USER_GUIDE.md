# 🔐 Transport Mix User Guide

## What Is the Transport Mix?

The **Transport Mix** is a 3-hop onion routing network that hides your IP address from blockchain RPC endpoints. When you submit transactions through the demo UI, your traffic is encrypted and routed through three independent nodes before reaching the blockchain.

Think of it like Tor, but optimized for blockchain RPC traffic.

## Why Does This Matter?

When you interact with a blockchain directly, the RPC server can see:
- ✅ Your IP address
- ✅ What transactions you're submitting
- ✅ When you're submitting them
- ✅ Your geographic location

With the Transport Mix:
- ✅ The blockchain only sees the **Exit Node's** IP
- ✅ The Entry Node only knows your IP, not what you're doing
- ✅ The Middle Node knows neither your IP nor your destination
- ✅ No single node can link you to your transactions

## How to Use It

### Step 1: Start the Demo

```bash
bash scripts/demo-start.sh
```

This starts:
1. Two parachains (DaoChain and VotingChain)
2. Three mix nodes (for ballot shuffling)
3. **Three transport nodes** (Entry → Middle → Exit)
4. **Two WS proxies** (intelligent routing)
5. The demo UI server

### Step 2: Open the Browser

Navigate to: **http://localhost:8080**

### Step 3: Connect via Transport Mix

In the UI, connect to:
- **DaoChain**: `ws://127.0.0.1:9950`
- **VotingChain**: `ws://127.0.0.1:9951`

These are the **WS proxy** endpoints, not the direct parachain endpoints.

### Step 4: Submit Transactions

When you:
- Create an election
- Cast a vote
- Submit an XCM job

Your transaction will **automatically** route through the 3-hop network!

### Step 5: Watch It Happen

Open a terminal and run:

```bash
tail -f .demo-logs/ws-proxies.log
```

You'll see output like:

```
[VotingChain] 🔄 Converting author_submitAndWatchExtrinsic to one-shot version
[VotingChain] 🔐 author_submitExtrinsic → via transport mix
[VotingChain] ✅ author_submitAndWatchExtrinsic → submitted via 3-hop mix (subscription emulated)
```

This proves your transaction went through:
1. **Entry Node** (encrypted with 3 layers)
2. **Middle Node** (peeled 1 layer, forwarded)
3. **Exit Node** (peeled final layer, sent to chain)

## How It Works (Technical)

### The Route

```
Your Browser (http://localhost:8080)
    ↓
    WebSocket Connection
    ↓
WS Proxy (ws://127.0.0.1:9950 or 9951)
    ├─→ Query/Subscription: Direct to parachain (fast)
    └─→ Transaction:
            ↓ HTTP + 3-layer encryption
        Entry Node (http://127.0.0.1:9100)
            ↓ HTTP + 2-layer encryption
        Middle Node (http://127.0.0.1:9101)
            ↓ HTTP + 1-layer encryption
        Exit Node (http://127.0.0.1:9102)
            ↓ HTTP (plaintext RPC)
        Parachain RPC (http://127.0.0.1:9933 or 9934)
```

### Why Hybrid (Direct + Transport Mix)?

**Queries and Subscriptions** → Direct WebSocket
- Reason: These don't reveal identity (just reading data)
- Benefit: Fast, no latency

**Transactions** → 3-Hop Transport Mix
- Reason: These reveal your identity (you're signing with your keys)
- Benefit: IP privacy, can't be linked to you

### Encryption Layers

Each message is encrypted three times:

```
Message: "Submit transaction X"
    ↓ Encrypt for Exit Node
Layer 1: 0xabc123...
    ↓ Encrypt for Middle Node
Layer 2: 0xdef456...
    ↓ Encrypt for Entry Node
Layer 3: 0x789ghi...
```

Sent to Entry Node → It can only peel off Layer 3  
Sent to Middle Node → It can only peel off Layer 2  
Sent to Exit Node → It reveals the original message  

No single node sees both your IP and your transaction!

## Privacy Guarantees

### What You Get ✅

1. **IP Anonymity**: The blockchain never sees your real IP
2. **No Single Point of Trust**: No node knows both ends
3. **Real Onion Encryption**: Each layer uses X25519 encryption
4. **Live Demo**: This is actually working, not a simulation

### What You Don't Get ❌

1. **Timing Resistance**: No batching or delays (yet)
2. **Network Anonymity**: Traffic analysis might still work
3. **Production Security**: Demo uses public, deterministic keys

## Verification

### Check Transport Node Public Keys

```bash
curl http://localhost:9100/health | jq
curl http://localhost:9101/health | jq
curl http://localhost:9102/health | jq
```

You should see consistent public keys (because we use fixed demo keys).

### Watch the Logs

**Entry Node:**
```bash
tail -f .demo-logs/transport-entry.log
```

**Middle Node:**
```bash
tail -f .demo-logs/transport-middle.log
```

**Exit Node:**
```bash
tail -f .demo-logs/transport-exit.log
```

**WS Proxy (routing decisions):**
```bash
tail -f .demo-logs/ws-proxies.log
```

### Test Script

We've provided a helper script:

```bash
./test-transport-mix-demo.sh
```

This will watch the logs and show you when transactions go through the mix.

## Troubleshooting

### "Connection Failed" in Browser

**Problem**: Can't connect to ws://127.0.0.1:9950 or 9951

**Solution**:
1. Check if proxies are running: `lsof -i :9950`
2. Check logs: `tail -f .demo-logs/ws-proxies.log`
3. Restart: `bash scripts/demo-cleanup.sh && bash scripts/demo-start.sh`

### "Transport mix error: 500" in Logs

**Problem**: Transport nodes have different keys than proxy expects

**Solution**:
1. Stop everything: `bash scripts/demo-cleanup.sh`
2. Restart: `bash scripts/demo-start.sh`
   (This ensures consistent keys from the start)

### Transactions Not Going Through Mix

**Problem**: Logs show "→ direct WS" for everything

**Solution**:
1. Verify transport nodes are running:
   ```bash
   curl http://localhost:9100/health
   curl http://localhost:9101/health
   curl http://localhost:9102/health
   ```
2. Check `mixer/src/wsTransportProxy.ts` has `PRIVACY_METHODS` enabled

## Performance

### Latency

Expect additional latency for transactions:
- Direct: ~10-50ms
- Via Transport Mix: ~100-300ms (3 hops)

Queries and subscriptions remain fast (direct connection).

### Throughput

The demo setup can handle:
- ~10-20 transactions per second through the mix
- ~100+ queries per second (direct)

For production, you'd add load balancing and multiple exit nodes.

## Security Notes

### DEMO KEYS ONLY! ⚠️

The transport nodes use fixed, public keys:
```
Entry:  0x1111...
Middle: 0x2222...
Exit:   0x3333...
```

**Never use these in production!** They're only for demonstration.

### Production Deployment

For real use, you'd need:
1. **Unique Keys**: Generate secure random keypairs
2. **Geographic Distribution**: Nodes in different countries
3. **TLS/HTTPS**: Encrypt transport between nodes
4. **Key Rotation**: Periodically change node keys
5. **Monitoring**: Detect compromised nodes
6. **Cover Traffic**: Send dummy transactions to hide patterns

## Comparison to Alternatives

### vs. Tor

| Feature | Transport Mix | Tor |
|---------|---------------|-----|
| Hops | 3 (fixed) | 3 (random) |
| Speed | Fast (~100ms) | Slow (~500ms+) |
| Blockchain optimized | Yes | No |
| Setup | Built-in | External binary |
| Directory service | Hardcoded | Consensus |

### vs. Direct RPC

| Feature | Transport Mix | Direct RPC |
|---------|---------------|------------|
| IP visible to chain | No ❌ | Yes ✅ |
| Latency | Medium | Low |
| Setup complexity | Medium | None |
| Privacy | High | None |

### vs. VPN

| Feature | Transport Mix | VPN |
|---------|---------------|-----|
| Trust required | None (3 nodes) | Full (VPN provider) |
| Onion encryption | Yes | No |
| Blockchain optimized | Yes | No |
| Cost | Free (self-hosted) | $$ subscription |

## FAQ

**Q: Does this slow down my dApp?**  
A: Only transactions are routed through the mix. Queries and subscriptions remain fast.

**Q: Can I disable the transport mix?**  
A: Yes, connect directly to `ws://127.0.0.1:9944` or `ws://127.0.0.1:9945` instead of the proxy ports.

**Q: Is this as secure as Tor?**  
A: For demo purposes with fixed keys, no. In production with proper keys and multiple operators, it could be comparable.

**Q: Can the transport nodes see my transactions?**  
A: The Exit Node sees the final plaintext RPC call but not your IP. The Entry Node sees your IP but not your transaction. The Middle Node sees neither.

**Q: What if a node is compromised?**  
A: You need at least 2 compromised nodes (Entry + Exit) to link you to your transactions. The Middle Node provides separation.

**Q: Why not just use a VPN?**  
A: VPNs require trusting a single provider. The transport mix distributes trust across 3 independent nodes.

## Next Steps

1. ✅ Start the demo and connect via transport mix
2. ✅ Create an election and watch the logs
3. ✅ Verify your transaction went through 3 hops
4. 📚 Read `TRANSPORT_MIX_FINAL.md` for technical details
5. 🧪 Run E2E tests: `cd mixer && npm run test:e2e`

## Support

For issues or questions:
1. Check logs: `.demo-logs/ws-proxies.log`
2. Verify nodes: `curl http://localhost:9100/health`
3. Restart demo: `bash scripts/demo-cleanup.sh && bash scripts/demo-start.sh`

---

**🎉 Enjoy your privacy-preserving blockchain demo!**

