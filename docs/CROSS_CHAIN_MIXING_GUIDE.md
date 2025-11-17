# Cross-Chain Mixing with MixJob Pallet

## What is Cross-Chain Mixing?

Imagine you have a voting system on one blockchain, but you want to keep everyone's votes completely private. Instead of building expensive privacy tech yourself, you can send your voting data to DaoChain - a specialized privacy blockchain - to do the anonymous mixing for you.

DaoMix lets **any blockchain in the Polkadot ecosystem** (and beyond) use this privacy service through "network hopping" - sending messages across different blockchains.

---

## Use Cases

### 1. Governance Voting
**Scenario**: A parachain wants to conduct anonymous governance votes without revealing voter identities or voting patterns.

**Example**: AcalaChain governance proposal
```rust
// On Acala parachain
let election_id = 12345;
let votes = collect_governance_ballots(proposal_id);

// Submit to DaoChain for mixing
pallet_xcm::execute_xcm(
    dest: DaoChain(1000),
    message: Transact(MixJob::submit_job(election_id))
);

// Wait for results
let tally = query_mix_results(election_id);
```

### 2. Private Token Voting
**Scenario**: Token holders vote on protocol parameters, but their token amounts and choices should remain private.

**Example**: Moonbeam treasury allocation vote
```rust
// Voters cast encrypted ballots on Moonbeam
cast_encrypted_ballot(voter, choice, token_amount);

// Submit mixing job to DaoChain
submit_xcm_mix_job(election_id: 5678);

// Retrieve anonymized results
let results = fetch_tally_from_daochain(5678);
```

### 3. DAO Decision Making
**Scenario**: Multiple parachains collaborate on a cross-chain DAO decision, requiring privacy.

**Example**: Polkadot Alliance vote
```rust
// Each parachain submits their encrypted votes
Statemint::submit_vote(election_id, encrypted_ballot);
AssetHub::submit_vote(election_id, encrypted_ballot);
BridgeHub::submit_vote(election_id, encrypted_ballot);

// Any parachain can trigger mixing
AssetHub::trigger_mixing_via_xcm(election_id);

// All parachains can verify results
let verified_tally = verify_merkle_commitment(election_id);
```

### 4. Anonymous Surveys/Polls
**Scenario**: Gather community sentiment without tracking individual responses.

**Example**: Kusama network upgrade poll
```rust
// Parachains collect responses
let responses = collect_community_poll(poll_id);

// Submit to DaoChain for anonymization
submit_poll_for_mixing(poll_id, responses);

// Public results available to all
let aggregated_results = query_poll_results(poll_id);
```

### 5. Private Auctions/Bidding
**Scenario**: Sealed-bid auctions where bids must remain secret until reveal phase.

**Example**: Parachain slot auction
```rust
// Bidders submit encrypted bids
submit_sealed_bid(auction_id, amount, signature);

// Trigger mixing to shuffle bids
trigger_bid_mixing(auction_id);

// Reveal phase with anonymized ordering
let sorted_bids = get_mixed_bids(auction_id);
```

### 6. Cross-Network Governance
**Scenario**: Multi-network DAOs conducting private votes across different blockchains.

**Example**: Polkadot + Ethereum governance
```typescript
// Ethereum voters cast ballots
ethereumContract.castBallot(electionId, encryptedVote);

// Kusama parachain triggers mixing
kusamaApi.tx.polkadotXcm.send(
  dest: DaoChain(Kusama),
  message: MixJob::submit_job(electionId)
);

// Polkadot parachain queries results
polkadotApi.query.mixJob.getTally(electionId);
```

### 7. Global DEX Privacy
**Scenario**: Decentralized exchanges across networks need private order matching.

**Example**: Cross-chain limit order book
```rust
// Orders submitted from multiple networks
polkadotPara.submitLimitOrder(buyOrder);
ethereumContract.submitLimitOrder(sellOrder);

// Mix orders for privacy-preserving matching
kusamaBridge.triggerOrderMixing(marketId);

// Execute matched orders privately
let matchedOrders = getMixedOrderBook(marketId);
```

---

## How It Works

### Simple Flow: Your Chain → DaoChain → Private Results

1. **You submit a job** from your blockchain to DaoChain
2. **DaoChain validates** the request came from a legitimate blockchain
3. **Mix nodes shuffle** your encrypted data to hide patterns
4. **Results are published** on DaoChain for anyone to verify

### Network Hopping: Crossing Between Blockchains

**What is Network Hopping?**
Like sending a letter through multiple postal systems, network hopping lets messages travel between different blockchains using bridges.

```
🌍 Your Blockchain → 🌉 Bridge → 🌍 Another Network → 🌉 Bridge → 🌍 DaoChain
```

**Why Network Hopping Matters:**
- **Polkadot parachain** can send jobs to **Kusama DaoChain**
- **Ethereum contracts** can use **Polkadot privacy services**
- **Any blockchain** can access DaoMix privacy technology

### Architecture Overview

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                           🌐 DAO MIX ARCHITECTURE                           ║
║                    Universal Cross-Chain Privacy System                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

╔══════════════╗    ╔══════════════╗    ╔══════════════╗    ╔══════════════╗
║  POLKADOT    ║    ║   KUSAMA     ║    ║  ETHEREUM    ║    ║   SOLANA     ║
║  PARA 100    ║    ║   PARA 200   ║    ║   CONTRACT   ║    ║    APP        ║
║  ┌─────────┐ ║    ║  ┌─────────┐ ║    ║  ┌─────────┐ ║    ║  ┌─────────┐ ║
║  │ SUBMIT  │ ║    ║  │ SUBMIT  │ ║    ║  │ SUBMIT  │ ║    ║  │ SUBMIT  │ ║
║  │ MIX JOB │ ║    ║  │ MIX JOB │ ║    ║  │ MIX JOB │ ║    ║  │ MIX JOB │ ║
║  └─────────┘ ║    ║  └─────────┘ ║    ║  └─────────┘ ║    ║  └─────────┘ ║
╚══════════════╝    ╚══════════════╝    ╚══════════════╝    ╚══════════════╝
        │                     │                     │                     │
        └─────────────────────┼─────────────────────┼─────────────────────┘
                              │
                    ╔═════════════════════════════════════╗
                    ║         🌉 NETWORK HOPPING         ║
                    ║    (Cross-Chain Message Routing)    ║
                    ╚═════════════════════════════════════╝
                              │
                    ┌─────────┴─────────┐
                    │                   │
           ╔════════▼════════╗ ╔════════▼════════╗
           ║  BRIDGE HUB     ║ ║   SNOWBRIDGE    ║
           ║ (Polkadot Relay)║ ║ (Ethereum Bridge)║
           ╚═════════════════╝ ╚═════════════════╝
                    │                   │
                    └─────────┬─────────┘
                              │
                    ╔═════════════════════════════════════╗
                    ║           🎯 DAO CHAIN             ║
                    ║        (Privacy Processing)        ║
                    ╚═════════════════════════════════════╝
                              │
                    ┌─────────┴─────────┐
                    │                   │
           ╔════════▼════════╗ ╔════════▼════════╗
           ║   XCM EXECUTOR  ║ ║   MIX JOB       ║
           ║ (Message Router)║ ║   PALLET        ║
           ╚═════════════════╝ ╚═════════════════╝
                    │                   │
                    └─────────┬─────────┘
                              │
                    ╔═════════════════════════════════════╗
                    ║          🔄 MIXING PROCESS         ║
                    ║       (Privacy-Preserving)         ║
                    ╚═════════════════════════════════════╝
                              │
                    ┌─────────┼─────────┬─────────┐
                    │         │         │         │
           ╔════════▼════════╗╚═════════▼═════════╝╚═════════▼═════════╗
           ║   MIX NODE 1    ║   MIX NODE 2   ║   MIX NODE 3   ║
           ║   (SHUFFLE)     ║   (SHUFFLE)     ║   (FINAL MIX)   ║
           ╚═════════════════╝═════════════════════════════════════╝
                              │
                    ╔═════════════════════════════════════╗
                    ║        📊 TALLY & VERIFY           ║
                    ║      (Cryptographic Proofs)        ║
                    ╚═════════════════════════════════════╝
                              │
                    ┌─────────┴─────────┐
                    │                   │
           ╔════════▼════════╗ ╔════════▼════════╗
           ║   FINAL RESULTS ║ ║  MERKLE PROOFS  ║
           ║ (Vote Totals)   ║ ║ (Verifiability)  ║
           ╚═════════════════╝ ╚═════════════════╝
                    │                   │
                    └─────────┬─────────┘
                              │
                    ╔═════════════════════════════════════╗
                    ║         🌍 PUBLIC RESULTS          ║
                    ║    (Any Chain Can Query Results)   ║
                    ╚═════════════════════════════════════╝
                              │
                    ┌─────────┼─────────┬─────────┬─────────┐
                    │         │         │         │         │
           ╔════════▼════════╗╚═════════▼═════════╝╚═════════▼═════════╝╚═════════▼═════════╗
           ║   POLKADOT     ║   KUSAMA      ║   ETHEREUM    ║   SOLANA      ║
           ║   RESULTS      ║   RESULTS     ║   RESULTS     ║   RESULTS     ║
           ╚═════════════════╝═════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════════╗
║                             🔐 PRIVACY GUARANTEES                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ • Vote contents remain encrypted throughout mixing process                 ║
║ • Mix nodes shuffle order, breaking voter-choice correlation              ║
║ • Final tally is mathematically correct but unlinkable to individuals      ║
║ • Merkle proofs allow anyone to verify result integrity                    ║
║ • Cross-chain queries possible from any participating network              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### The Privacy Magic: Mix Nodes

Your encrypted votes go through 3+ independent mix nodes that:
- **Shuffle** the order randomly (like mixing cards)
- **Hide patterns** between voters and their choices
- **Prove correctness** with mathematical proofs

**Final Result:** Vote totals are 100% accurate, but no one can tell who voted for what.

---

## How to Use Cross-Chain Mixing

### Step 1: Create Your Election

First, set up your voting election on DaoChain:

```typescript
// Simple JavaScript/TypeScript
const electionId = 12345;

// Create election on DaoChain
await daoChainApi.tx.daomixVoting.createElection(
  electionId,        // Your election ID
  startBlock,        // When voting starts
  endBlock          // When voting ends
).signAndSend(yourAccount);
```

### Step 2: Cast Encrypted Votes

Voters encrypt their choices before submitting:

```typescript
// Encrypt vote (done automatically by DaoMix SDK)
const encryptedVote = encryptBallot("YES", voterKey, mixNodeKeys);

// Submit to DaoChain
await daoChainApi.tx.daomixVoting.castBallot(
  electionId,
  encryptedVote
).signAndSend(voter);
```

### Step 3: Submit Mixing Job

From your blockchain, tell DaoChain to mix the votes:

```typescript
// From your parachain - simple call
await yourChainApi.tx.polkadotXcm.send(
  // Target: DaoChain on another network
  { parents: 2, interior: { X1: { Parachain: 1000 } } },

  // Message: Start mixing job
  {
    V3: [{
      Transact: {
        call: daoChainApi.tx.mixJob.submitJob(electionId).toHex()
      }
    }]
  }
);
```

### Step 4: Get Results

Anyone can check the final, private results:

```typescript
// Check results from any blockchain
const results = await daoChainApi.query.daomixVoting.tallyResults(electionId);
console.log(results); // { "YES": 75, "NO": 25 }
```

---

## Network Hopping Controls

### 🚨 **QUICK ON/OFF SWITCH**

**To ENABLE network hopping:** Set `NETWORK_HOPPING_ENABLED: true` in `AllowCrossNetworkMixJob`
**To DISABLE network hopping:** Set `NETWORK_HOPPING_ENABLED: false` in `AllowCrossNetworkMixJob`

```rust
// Find this in runtime/src/xcm_config.rs
pub const NETWORK_HOPPING_ENABLED: bool = true;  // true = ON, false = OFF
```

---

### When to Turn It On

**Enable network hopping when:**
- You want other blockchains to use your privacy services
- Testing cross-network functionality
- Production deployment with bridge connections ready

### When to Turn It Off

**Disable network hopping when:**
- Security concerns with cross-network messages
- Maintenance or upgrades needed
- Regulatory requirements
- Emergency situations

### Emergency Stop

If something goes wrong, you can quickly disable by changing `true` to `false` and redeploying the runtime.

---

## Key Benefits

- **Universal Privacy**: Any blockchain can use DaoMix privacy services
- **No Extra Development**: Leverage existing privacy infrastructure
- **Trust-Minimized**: Cryptographic proofs ensure correctness
- **Cost Effective**: Share privacy costs across multiple networks

---

## Quick Start Checklist

- [ ] Set `NETWORK_HOPPING_ENABLED: true` in runtime
- [ ] Deploy DaoChain with MixJob pallet
- [ ] Configure bridge connections (if cross-network)
- [ ] Start mix nodes
- [ ] Test cross-chain job submission
- [ ] Verify results are private and correct

---

## Support

**Need Help?**
- Check the main README for setup instructions
- Join DaoMix community discussions
- Review test files for examples

**Current Status**: Network hopping feature is ready for testing and production use.

---

## Summary

DaoMix enables **universal cross-chain privacy** through network hopping:

1. **Any blockchain** can submit mixing jobs to DaoChain
2. **Messages hop** across networks using bridges
3. **Privacy is preserved** through cryptographic mixing
4. **Results are verifiable** by anyone, anywhere

**The main control?** Just one boolean: `NETWORK_HOPPING_ENABLED: true/false`

**Ready to make blockchain voting private worldwide?** 🌍🔒✨
