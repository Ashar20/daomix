# @polokol/daomix-sdk

**Hybrid post-quantum mixnet SDK for on-chain voting**

This SDK provides a complete toolkit for building privacy-preserving voting systems using onion routing and post-quantum cryptography.

## Features

- 🔐 **Hybrid Cryptography**: Classical (X25519) + Post-Quantum (ML-KEM-768) support
- 🧅 **Onion Routing**: Multi-hop encryption for ballots and transport layers
- 🗳️ **Substrate Integration**: Ready-to-use Polkadot/Substrate client helpers
- ✂️ **Sharding & Bundling**: Split ciphertexts into shards with Merkle commitments
- 🚀 **Transport Mix**: JSON-RPC proxy through 3-hop onion network
- 📦 **TypeScript First**: Full type safety with comprehensive type definitions

## Installation

```bash
npm install @polokol/daomix-sdk
```

## Quick Start

```typescript
import {
  initCrypto,
  generateKeypair,
  buildOnion,
  peelOnionForNode,
  decryptFinalForTally,
} from "@polokol/daomix-sdk";

// Initialize crypto
await initCrypto();

// Generate keypairs
const sender = generateKeypair();
const node1 = generateKeypair();
const node2 = generateKeypair();
const tally = generateKeypair();

// Build onion-encrypted ballot
const vote = new TextEncoder().encode("VOTE_OPTION_A");
const onion = await buildOnion({
  vote,
  mixNodes: [
    { publicKey: node1.publicKey },
    { publicKey: node2.publicKey },
  ],
  tally: { publicKey: tally.publicKey },
  senderKeypair: sender,
});

// Peel layers (in real usage, this happens on mix nodes)
const afterNode1 = await peelOnionForNode(onion, node1, sender.publicKey);
const afterNode2 = await peelOnionForNode(afterNode1, node2, sender.publicKey);
const final = await decryptFinalForTally(afterNode2, tally, sender.publicKey);

console.log(new TextDecoder().decode(final)); // "VOTE_OPTION_A"
```

## API Documentation

### Core Crypto

- `initCrypto()` - Initialize libsodium (required before use)
- `generateKeypair()` - Generate X25519 keypair
- `encryptLayer()` / `decryptLayer()` - Classical encryption/decryption
- `deriveHybridAeadKey()` - Hybrid key derivation (classical + PQ)
- `deriveHybridAeadKeyForReceiver()` - Receiver-side hybrid key derivation

### Post-Quantum Crypto

- `initPq()` - Initialize ML-KEM (required before PQ operations)
- `generatePqKeypair()` - Generate ML-KEM-768 keypair
- `pqEncapsulate()` - PQ key encapsulation
- `pqDecapsulate()` - PQ key decapsulation
- `combineSharedSecrets()` - Combine classical and PQ shared secrets

### Onion Routing

- `buildOnion()` - Build multi-layer onion for ballots
- `peelOnionForNode()` - Peel one layer from onion
- `decryptFinalForTally()` - Final decryption at tally node
- `buildTransportOnion()` - Build onion for JSON-RPC transport
- `peelTransportLayer()` - Peel transport onion layer

### Substrate Integration

- `connectDaoChain()` - Connect to Substrate node
- `createElectionTx()` - Create election on-chain
- `registerVoterTx()` - Register voter for election
- `castVoteTx()` - Cast encrypted ballot
- `submitTallyTx()` - Submit final tally results

### Utilities

- `shardCiphertext()` - Split ciphertext into shards
- `reconstructFromShards()` - Reconstruct ciphertext from shards
- `createBundles()` - Group shards into bundles with Merkle roots
- `loadMixNodes()` - Load mix node configuration
- `loadTransportConfig()` - Load transport mix configuration

## Configuration

### Environment Variables

**Core Config:**
- `DAOMIX_PQ_ENABLED` - Enable post-quantum hybrid mode (default: `false`)
- `MIX_NODE_URLS` - Comma-separated mix node URLs
- `MIX_NODE_PUBLIC_KEYS` - Comma-separated X25519 public keys (hex)
- `MIX_NODE_PQ_PUBLIC_KEYS` - Comma-separated ML-KEM public keys (hex, optional)

**Transport Mix:**
- `DAOCHAIN_TRANSPORT_ENABLED` - Enable transport mix (default: `false`)
- `DAOCHAIN_TRANSPORT_NODE_URLS` - Transport node URLs
- `DAOCHAIN_TRANSPORT_NODE_PUBKEYS` - Transport node X25519 keys
- `DAOCHAIN_TRANSPORT_NODE_PQ_PUBKEYS` - Transport node ML-KEM keys (optional)

See `hybrid/.env.example` for complete configuration template.

## Examples

The `examples/` directory contains:
- `runDaoMixDaoChain.ts` - Full end-to-end pipeline
- `runTransportRpc.ts` - Transport mix demo
- `orchestratorDemo.ts` - Mix chain orchestrator demo
- `castOnionBallotsDemo.ts` - Ballot casting demo

## Servers

The `servers/` directory contains:
- `mixNodeServer.ts` - Mix node HTTP server
- `transportNodeServer.ts` - Transport mix node server
- `orchestrator.ts` - Mix chain orchestrator
- `castOnionBallots.ts` - Onion ballot casting utilities

## Testing

```bash
npm test
```

Tests cover:
- Onion routing round-trips
- Post-quantum crypto operations
- Sharding and bundling
- Hybrid key derivation

## License

MIT
