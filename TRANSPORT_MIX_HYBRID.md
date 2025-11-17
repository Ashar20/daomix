# 🔐 Hybrid Transport Mix Architecture

## Overview

The demo uses a **hybrid approach** that balances **performance** and **privacy**:

- **Subscriptions/Queries**: Direct WebSocket (fast, no privacy risk)
- **Transactions**: Transport mix with 3-hop onion routing (protects identity)

## Why Hybrid?

### WebSocket Subscriptions Challenge

Polkadot.js heavily uses WebSocket subscriptions for real-time updates:
- `chain_subscribeNewHeads` - new blocks
- `state_subscribeRuntimeVersion` - runtime upgrades  
- `chain_subscribeFinalized` - finalized blocks

These are **long-lived connections** that send continuous updates. The transport mix is designed for **request/response** patterns, not persistent subscriptions.

### Privacy Analysis

| Operation | Reveals Identity? | Routing Strategy |
|-----------|-------------------|------------------|
| **Subscribe to new blocks** | ❌ No | Direct WS (everyone sees same blocks) |
| **Query chain state** | ❌ No | Direct WS (public data) |
| **Get account balance** | ⚠️ Maybe | Direct WS (reading only) |
| **Submit transaction** | ✅ YES | **Transport mix** (submitting = acting) |
| **Create election** | ✅ YES | **Transport mix** (write operation) |
| **Cast vote** | ✅ YES | **Transport mix** (needs privacy!) |

**Key insight**: Reading public chain data doesn't expose your identity. But **submitting transactions** links your IP to your on-chain actions → needs transport mix.

## Architecture

```
Browser
    ↓
    ↓ WebSocket (9950/9951)
    ↓
┌──────────────────────────────────────┐
│   Hybrid WS Proxy (wsTransportProxy) │
│                                      │
│   IF method = transaction:           │
│   ┌───────────────────────────────┐  │
│   │ Transport Mix (3-hop onion)   │  │
│   │ Entry → Middle → Exit         │  │
│   └───────────────────────────────┘  │
│            ↓                         │
│   ELSE (subscriptions/queries):     │
│   ┌───────────────────────────────┐  │
│   │ Direct WebSocket passthrough  │  │
│   └───────────────────────────────┘  │
└──────────────────────────────────────┘
    ↓
Parachain (9944/9945)
```

## Privacy-Protected Methods

The following RPC methods route through transport mix:

```typescript
const PRIVACY_METHODS = [
  'author_submitExtrinsic',           // Submit signed transaction
  'author_submitAndWatchExtrinsic',   // Submit + watch status
  'system_accountNextIndex',          // Get nonce (precedes transaction)
];
```

Everything else (subscriptions, state queries, metadata) goes direct.

## How It Works

### 1. Browser Connects

```javascript
// Browser connects to hybrid proxy
const api = await ApiPromise.create({
  provider: new WsProvider('ws://127.0.0.1:9950')
});
```

### 2. Proxy Decides Routing

```typescript
if (needsPrivacy(method)) {
  // Route through transport mix
  console.log('🔐 Transaction → via 3-hop mix');
  
  const response = await sendRpcOverTransportMix({
    entryNodeUrl: 'http://127.0.0.1:9100',
    rpcUrl: 'http://127.0.0.1:9933',
    method,
    params,
    transportNodes: [entry, middle, exit],
  });
  
  clientWs.send(JSON.stringify(response));
} else {
  // Pass through directly
  console.log('📖 Query/Subscription → direct WS');
  parachainWs.send(data);
}
```

### 3. Transaction Flow (Private)

```
User clicks "Create Election"
    ↓
Browser: author_submitExtrinsic
    ↓
Proxy: 🔐 Detected privacy method
    ↓
Build 3-layer onion:
  Layer 3: Encrypt for Exit node
  Layer 2: Encrypt for Middle node  
  Layer 1: Encrypt for Entry node
    ↓
POST to Entry (9100)
    ↓
Entry peels layer 1 → POST to Middle (9101)
    ↓
Middle peels layer 2 → POST to Exit (9102)
    ↓
Exit peels layer 3 → JSON-RPC to DaoChain (9933)
    ↓
Response flows back through layers
    ↓
Proxy sends to browser
```

### 4. Subscription Flow (Fast)

```
Polkadot.js: chain_subscribeNewHeads
    ↓
Proxy: 📖 Not a privacy method
    ↓
Forward directly via persistent WS
    ↓
Parachain: sends block updates continuously
    ↓
Proxy: forwards updates to browser
```

## Benefits

✅ **Performance**: Subscriptions are fast (no onion overhead)  
✅ **Privacy**: Transactions hide your IP address  
✅ **Compatibility**: Works with standard Polkadot.js API  
✅ **Real**: Uses your actual transport mix implementation  
✅ **Transparent**: User doesn't need to know about routing  

## Privacy Guarantees

| Entity | Subscriptions | Transactions |
|--------|---------------|--------------|
| **Entry Node** | Doesn't see | Sees your IP, encrypted onion |
| **Middle Node** | Doesn't see | Sees Entry IP, Exit IP |
| **Exit Node** | Doesn't see | Sees Middle IP, transaction |
| **Parachain** | Sees your IP | Sees Exit IP only |

**Result**: 
- Reading chain state: No privacy protection (but no privacy risk)
- Submitting transactions: **Full 3-hop onion protection**

## Logs

Watch the routing decisions in real-time:

```bash
tail -f .demo-logs/ws-proxies.log
```

You'll see:
```
[DaoChain] 📖 chain_getBlockHash → direct WS
[DaoChain] 📖 state_getMetadata → direct WS
[DaoChain] 📖 chain_subscribeNewHeads → direct WS
[DaoChain] 🔐 author_submitExtrinsic → via transport mix
[DaoChain] ✅ author_submitExtrinsic → sent via 3-hop mix
```

## Testing

1. **Start demo:**
   ```bash
   bash scripts/demo-start.sh
   ```

2. **Open browser:** http://127.0.0.1:8080

3. **Connect to proxies:**
   - DaoChain: `ws://127.0.0.1:9950`
   - VotingChain: `ws://127.0.0.1:9951`

4. **Create an election** → Watch logs show `🔐 via transport mix`

5. **Observe block updates** → Fast, no transport mix overhead

## Future Enhancements

### Option 1: Full Transport Mix for Everything
- Route ALL RPC through transport mix
- Requires transport nodes to support WebSocket subscriptions
- Adds latency to UI updates

### Option 2: Circuit Establishment
- Establish persistent onion circuit at connection time
- Reuse circuit for multiple transactions
- Reduces overhead for frequent transactions

### Option 3: Configurable Privacy Levels
```typescript
// Let user choose
const api = await ApiPromise.create({
  provider: new WsProvider('ws://127.0.0.1:9950'),
  privacyLevel: 'transactions' | 'everything' | 'off'
});
```

## Summary

The hybrid approach gives you:
- ✅ **Real transport mix** for sensitive operations (transactions)
- ✅ **Fast subscriptions** for UI responsiveness  
- ✅ **No mocks** - uses your production transport mix code
- ✅ **Practical balance** between privacy and usability

**When you submit a vote or create an election, your IP is protected by 3-hop onion routing.** 🔒

