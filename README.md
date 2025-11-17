# DaoMix: Cross-Chain Privacy Infrastructure

**Chaum-style mixnet for anonymous communication, voting, and journalism across Polkadot parachains with post-quantum security.**

## Problem

Blockchain transparency enables surveillance and coercion:
- **Voting**: Vote buying, retaliation against dissenting voters
- **Messaging**: Identity correlation, censorship of private communications
- **Journalism**: Source exposure, publisher tracking, content censorship
- **General**: IP address correlation, cross-chain identity linking

Existing solutions either require trusted parties, don't scale, or lack cross-chain interoperability.

## Solution

DaoMix provides a **decentralized mixnet** that enables:
- **Anonymous voting**: Votes cannot be traced to voters after mixing
- **Encrypted messaging**: Private communications with unlinkable sender/receiver
- **Censorship-resistant publishing**: Anonymous journalism with IPFS storage
- **Cross-chain privacy**: Any parachain can submit mixing jobs via XCM
- **IP protection**: Transport mix routes transactions through 3-hop onion routing
- **Post-quantum security**: Hybrid ML-KEM encryption for future-proof cryptography
- **Verifiable results**: Merkle commitments enable independent verification

By default we use classical X25519 + XChaCha20-Poly1305, but the mixer has a hybrid post-quantum mode that combines X25519 with ML-KEM (Kyber) for onion layers and transport hops. See mixer/hybrid/README.md: “Optional post-quantum hybrid mode (X25519 + ML-KEM)” and the environment flags DAOMIX_PQ_ENABLED, PQ public keys, etc. When that flag is on, every onion layer carries both the classical curve share and an ML-KEM encapsulation, so even if X25519 were broken in the future, attackers would still have to break Kyber to recover ballots. TL;DR: out of the box it’s classical, but the repo already includes a real optional PQ hybrid path; switch it on and you get quantum-safe forward secrecy today.

## Architecture

```
┌─────────────────┐
│  Any Parachain  │
│  (Para 2001)    │
└────────┬────────┘
         │ XCM Message
         │ MixJob::submit_job(content_id)
         ↓
┌─────────────────┐
│   DaoChain      │
│  (Para 1000)    │
│                 │
│  • DaomixVoting │
│  • MixJob       │
│  • Publishing   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Orchestrator    │
│  (Off-chain)     │
└────────┬────────┘
         │
         ├─→ Mix Node 1 (peel layer 1, shuffle)
         ├─→ Mix Node 2 (peel layer 2, shuffle)
         ├─→ Mix Node 3 (peel layer 3, shuffle)
         │
         ↓
┌─────────────────┐
│  Results/Content│
│  (On-chain/IPFS)│
└─────────────────┘
```

## Encryption Layers

### Content Encryption (4-Layer Onion)

Messages, votes, or published content are encrypted in reverse order (innermost to outermost):

```
Content (plaintext: vote, message, or article)
    ↓ Encrypt for Recipient/Tally Authority
Layer 4: {content, metadata} encrypted with Recipient PK
    ↓ Encrypt for Mix Node 3
Layer 3: Layer 4 encrypted with Mix3 PK
    ↓ Encrypt for Mix Node 2
Layer 2: Layer 3 encrypted with Mix2 PK
    ↓ Encrypt for Mix Node 1
Layer 1: Layer 2 encrypted with Mix1 PK
    ↓
Final encrypted payload (stored on-chain or IPFS)
```

**Cryptographic primitives:**
- **Key exchange**: X25519 ECDH
- **Symmetric encryption**: XChaCha20-Poly1305 AEAD
- **Post-quantum**: ML-KEM-768 (optional hybrid mode)
- **Key derivation**: HKDF with context "DaoMix-layer" or "DaoMix-hybrid-layer"

**Hybrid encryption (when PQ enabled):**
```typescript
// Sender side
classicalSecret = X25519(senderSK, recipientPK)
pqSecret = ML-KEM.encapsulate(recipientPQPK)
combinedSecret = KDF(classicalSecret || pqSecret)
symmetricKey = HKDF(combinedSecret, "DaoMix-hybrid-layer")
ciphertext = XChaCha20-Poly1305(plaintext, symmetricKey, nonce)
```

**Layer peeling (mix node side):**
```typescript
// Each mix node
classicalSecret = X25519(nodeSK, senderPK)
pqSecret = ML-KEM.decapsulate(pqCiphertext, nodePQSK)
combinedSecret = KDF(classicalSecret || pqSecret)
symmetricKey = HKDF(combinedSecret, "DaoMix-hybrid-layer")
plaintext = XChaCha20-Poly1305.decrypt(ciphertext, symmetricKey, nonce)
```

### Transport Mix (3-Layer Onion)

Protects IP addresses during transaction submission:

```
RPC Request (plaintext)
    ↓ Encrypt for Exit Node
Layer 3: {rpcUrl, rpcBody} encrypted with Exit PK
    ↓ Encrypt for Middle Node
Layer 2: Layer 3 encrypted with Middle PK
    ↓ Encrypt for Entry Node
Layer 1: Layer 2 encrypted with Entry PK
    ↓
POST to Entry Node
```

**Routing:**
- **Queries/Subscriptions**: Direct WebSocket (no privacy risk)
- **Transactions**: 3-hop transport mix (IP protection)

## Data Flow

### 1. Content Creation (Voting/Messaging/Publishing)

**Voting:**
```typescript
// Voter encrypts vote
const onion = await buildOnion({
  vote: encodeVote(choice),
  mixNodes: [mix1, mix2, mix3],
  tally: tallyKeypair,
  senderKeypair: voterKeypair
});
await api.tx.daomixVoting.castBallot(electionId, onion).signAndSend(...);
```

**Messaging:**
```typescript
// Encrypt message for recipient
const onion = await buildOnion({
  message: encodeMessage(text, recipientAddress),
  mixNodes: [mix1, mix2, mix3],
  recipient: recipientKeypair,
  senderKeypair: senderKeypair
});
await api.tx.messaging.sendMessage(onion).signAndSend(...);
```

**Publishing:**
```typescript
// Encrypt article, store on IPFS
const plaintext = JSON.stringify({ title, content, timestamp });
const encrypted = await buildOnion({
  content: plaintext,
  mixNodes: [mix1, mix2, mix3],
  publisher: publisherKeypair,
  senderKeypair: senderKeypair
});
const ipfsCid = await uploadToIpfs(encrypted);
await api.tx.publishing.publish(ipfsCid, encryptedMetadata).signAndSend(...);
```

### 2. Cross-Chain Job Submission
```typescript
// Parachain submits mixing job via XCM (for votes, messages, or content)
const xcmMessage = {
  origin: { parents: 1, interior: { X1: { Parachain: 2001 } } },
  instructions: [
    WithdrawAsset(...),
    BuyExecution(...),
    Transact(MixJob::submit_job(contentId)) // electionId, messageId, or articleId
  ]
};

// DaoChain validates barrier (AllowMixJobFromSiblings)
// Creates MixJob with status: Pending
```

### 3. Mixing Process

**Orchestrator:**
1. Polls for pending jobs
2. Fetches encrypted content from chain (ballots, messages, or articles)
3. Routes through mix nodes with sharding

**Sharding (between hops):**
```typescript
// After each mix node (except last)
const shards = shardCiphertext(peeledCiphertext, shardCount);
// Each payload split into k shards
// Shards shuffled independently
// Reconstructed before next hop
```

**Mix Node operations:**
```typescript
// Each mix node
1. Decrypt outer layer (X25519 + XChaCha20-Poly1305)
2. Shuffle payloads (Fisher-Yates)
3. Re-encrypt for next hop
4. Return shuffled ciphertexts + permutation
```

**Final decryption:**
```typescript
// For voting: Orchestrator decrypts Layer 4 with Tally key
const votes = decryptLayer(tallySK, senderPK, finalCiphertexts);
const tally = computeTally(votes);

// For messaging: Recipient decrypts with their private key
const messages = decryptLayer(recipientSK, senderPK, finalCiphertexts);

// For publishing: Content decrypted and stored on IPFS
const articles = decryptLayer(publisherSK, senderPK, finalCiphertexts);
```

### 4. On-Chain Posting

**Voting:**
```typescript
// Compute Merkle commitments
const inputRoot = buildMerkleRoot(encryptedBallots);
const outputRoot = buildMerkleRoot(decryptedVotes);

// Submit tally results
await api.tx.daomixVoting.submitTally(electionId, {
  tally,
  inputRoot,
  outputRoot,
  resultUri: ipfsHash
}).signAndSend(...);
```

**Messaging:**
```typescript
// Messages delivered to recipients
// Recipients decrypt with their private keys
// No on-chain posting needed (direct delivery)
```

**Publishing:**
```typescript
// Encrypted content stored on IPFS
// Metadata (IPFS CID, encrypted hash) stored on-chain
// Publisher identity hidden through mixing
await api.tx.publishing.publish(ipfsCid, encryptedMetadata).signAndSend(...);
```

## Technical Implementation

### Components

**Parachain (DaoChain):**
- `pallet-daomix-voting`: Election management, ballot storage, tally submission
- `pallet-mix-job`: Cross-chain job submission via XCM, job lifecycle management
- `pallet-publishing`: Encrypted content publishing with IPFS integration
- XCM barriers: `AllowMixJobFromSiblings` (validates sibling parachain origin)

**Mix Nodes:**
- HTTP servers exposing `/mix` endpoint
- X25519 keypairs for layer decryption
- Optional ML-KEM keypairs for post-quantum security
- Fisher-Yates shuffling algorithm
- Sharding support (splits/reconstructs ciphertexts)

**Orchestrator:**
- Polls `MixJob` pallet for pending jobs
- Fetches encrypted content from pallets (ballots, messages, articles)
- Coordinates mix node network
- Computes Merkle commitments
- Submits results on-chain or delivers to recipients

**Transport Mix:**
- WS Proxy: Routes queries directly, transactions through mix
- Entry/Middle/Exit nodes: 3-hop onion routing
- Protects IP addresses during transaction submission

### Cryptography

**Classical (default):**
- X25519 ECDH for key exchange
- XChaCha20-Poly1305 AEAD for encryption
- HKDF for key derivation

**Post-quantum (optional):**
- ML-KEM-768 for key encapsulation
- Hybrid mode: Combines classical + PQ secrets
- Backward compatible (falls back if PQ keys missing)

### Sharding

**Purpose**: Prevents correlation attacks by splitting content into shards

**Process**:
1. After each mix node (except last), split each payload into k shards
2. Shards shuffled independently
3. Reconstruct payloads before next hop
4. Final hop returns complete payloads

**Implementation**:
```typescript
function shardCiphertext(ciphertext: HexString, shardCount: number): Shard[] {
  const bytes = fromHex(ciphertext);
  const shardSize = Math.ceil(bytes.length / shardCount);
  // Split into shards with deterministic IDs
  return shards;
}
```

## Use Cases

1. **Anonymous Voting**: Governance votes, DAO decisions, token voting
2. **Encrypted Messaging**: Private communications with unlinkable sender/receiver
3. **Censorship-Resistant Publishing**: Anonymous journalism, whistleblowing, dissident content
4. **Private Auctions**: Sealed-bid auctions with anonymized ordering
5. **Anonymous Surveys**: Community sentiment without tracking individual responses

## Novelty

1. **First cross-chain mixnet on Polkadot**: Enables any parachain to use privacy infrastructure via XCM
2. **Multi-purpose privacy**: Supports voting, messaging, and publishing in one system
3. **Hybrid post-quantum encryption**: ML-KEM integration with classical cryptography
4. **Transport mix for blockchain RPC**: IP protection during transaction submission
5. **Sharding between mix nodes**: Prevents correlation attacks
6. **Verifiable mixing**: Merkle commitments enable independent verification

## Quick Start

```bash
# Install dependencies
npm install

npm run demo:setup
# Start demo (2 parachains + 3 mix nodes + transport mix)
npm run demo:start

# Open browser
# http://localhost:8080
```

## Documentation

- [Cross-Chain Mixing Guide](docs/CROSS_CHAIN_MIXING_GUIDE.md) - Integration guide for parachains
- [XCM Implementation](docs/REAL_XCM_IMPLEMENTATION.md) - Technical proof of XCM mixing
- [Transport Mix](docs/TRANSPORT_MIX_COMPLETE.md) - IP protection architecture
- [Demo Guide](docs/DEMO_COMPLETE.md) - Complete demo walkthrough

## Status

✅ **Working:**
- XCM cross-chain mixing
- 4-layer onion encryption
- Mix node network with sharding
- Transport mix (3-hop IP protection)
- Post-quantum ML-KEM (optional)
- Merkle commitments for verification