# Cross-Chain Mixing with MixJob Pallet

## Overview

The MixJob pallet enables **any parachain in the Polkadot ecosystem** to submit anonymous voting/mixing jobs to DaoChain via XCM (Cross-Consensus Messaging). This allows parachains to leverage DaoMix's privacy-preserving mixing infrastructure without running their own mixing nodes.

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

---

## How It Works

### Architecture

```
┌─────────────────┐
│  Your Parachain │
│    (e.g. 2000)  │
└────────┬────────┘
         │ 1. Submit XCM
         │    MixJob::submit_job(election_id)
         ▼
┌─────────────────────────────────────────┐
│         DaoChain (Para 1000)            │
│  ┌──────────────────────────────────┐  │
│  │  XCM Executor                    │  │
│  │  - Validates sibling origin      │  │
│  │  - Derives sovereign account     │  │
│  │  - Creates MixJob                │  │
│  └──────────────┬───────────────────┘  │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │  MixJob Pallet                   │  │
│  │  - Tracks job status             │  │
│  │  - Stores requester info         │  │
│  └──────────────┬───────────────────┘  │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │  DaoMix Orchestrator             │  │
│  │  - Fetches encrypted ballots     │  │
│  │  - Runs through mix nodes        │  │
│  │  - Decrypts and tallies          │  │
│  │  - Stores results on-chain       │  │
│  └──────────────┬───────────────────┘  │
└─────────────────┼───────────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
    Mix Node 1        Mix Node 2
    (Shuffle)         (Shuffle)
         │                 │
         └────────┬────────┘
                  ▼
            Mix Node 3
            (Final shuffle)
                  │
                  ▼
           Decryption & Tally
                  │
                  ▼
      ┌───────────────────────┐
      │  Results on DaoChain  │
      │  - Tally counts       │
      │  - Merkle commitments │
      │  - Verifiable proofs  │
      └───────────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
   Parachain 2000    Parachain 2001
   (Query results)   (Query results)
```

---

## Integration Guide

### Step 1: Configure XCM on Your Parachain

Add DaoChain as a trusted destination in your parachain's XCM configuration:

```rust
// runtime/src/xcm_config.rs
pub struct XcmConfig;
impl xcm_executor::Config for XcmConfig {
    type Barrier = (
        AllowTopLevelPaidExecutionFrom<Everything>,
        // Allow calls to DaoChain MixJob pallet
        AllowExplicitUnpaidExecutionFrom<ParentOrSiblings>,
    );
    // ... other config
}
```

### Step 2: Create Election on DaoChain

Before submitting a mixing job, create an election to hold the encrypted ballots:

```typescript
// Using @polkadot/api
import { ApiPromise, WsProvider } from "@polkadot/api";

const api = await ApiPromise.create({
  provider: new WsProvider("wss://daochain-rpc.example.com")
});

// Create election
const tx = api.tx.daomixVoting.createElection(
  electionId,      // Unique ID for your election
  startBlock,      // When voting starts
  endBlock         // When voting ends
);

await tx.signAndSend(adminAccount);
```

### Step 3: Cast Encrypted Ballots

Voters on your parachain encrypt their ballots using onion encryption:

```typescript
import { encryptOnionBallot } from "@polokol/daomix-sdk";

// Encrypt ballot with multiple layers
const encryptedBallot = encryptOnionBallot(
  plaintext: "CANDIDATE_A",
  senderPublicKey: "0x...",    // Sender's public key
  mixNodeKeys: [node1Pk, node2Pk, node3Pk],
  tallyPublicKey: "0x..."      // Tally decryption key
);

// Submit to DaoChain
const castTx = api.tx.daomixVoting.castBallot(
  electionId,
  encryptedBallot
);

await castTx.signAndSend(voterAccount);
```

### Step 4: Submit Mixing Job via XCM

From your parachain, send an XCM message to trigger the mixing process:

```rust
// On your parachain runtime
use xcm::latest::prelude::*;

// Construct XCM message
let xcm_message = Xcm(vec![
    WithdrawAsset((Here, 1_000_000_000u128).into()),
    BuyExecution {
        fees: (Here, 1_000_000_000u128).into(),
        weight_limit: Unlimited,
    },
    Transact {
        origin_kind: OriginKind::SovereignAccount,
        require_weight_at_most: Weight::from_parts(1_000_000_000, 65536),
        call: <DaoChain as Config>::RuntimeCall::MixJob(
            pallet_mix_job::Call::submit_job {
                election_id: 42
            }
        ).encode().into(),
    },
]);

// Send to DaoChain (ParaId 1000)
pallet_xcm::Pallet::<T>::send(
    origin,
    Box::new(Location::new(1, X1(Parachain(1000)))),
    Box::new(xcm_message),
)?;
```

**TypeScript Alternative** (using polkadot.js):

```typescript
// Construct XCM message on your parachain
const dest = api.createType("XcmVersionedLocation", {
  V4: {
    parents: 1,
    interior: {
      X1: [{ Parachain: 1000 }]  // DaoChain
    }
  }
});

const message = api.createType("XcmVersionedXcm", {
  V4: [
    {
      WithdrawAsset: [{
        id: { parents: 0, interior: "Here" },
        fun: { Fungible: 1_000_000_000 }
      }]
    },
    {
      BuyExecution: {
        fees: {
          id: { parents: 0, interior: "Here" },
          fun: { Fungible: 1_000_000_000 }
        },
        weightLimit: "Unlimited"
      }
    },
    {
      Transact: {
        originKind: "SovereignAccount",
        requireWeightAtMost: {
          refTime: 1_000_000_000,
          proofSize: 65536
        },
        call: {
          encoded: api.tx.mixJob.submitJob(42).method.toHex()
        }
      }
    }
  ]
});

// Send XCM
const tx = api.tx.polkadotXcm.send(dest, message);
await tx.signAndSend(senderAccount);
```

### Step 5: Monitor Job Status

Query the job status to know when mixing is complete:

```typescript
// Connect to DaoChain
const daoApi = await ApiPromise.create({
  provider: new WsProvider("wss://daochain-rpc.example.com")
});

// Get job info
const jobId = await daoApi.query.mixJob.lastJobForElection(electionId);
const job = await daoApi.query.mixJob.jobs(jobId);

console.log("Job Status:", job.status.toString());
// Outputs: "Pending" | "Running" | "Completed" | "Failed"

console.log("Requester:", job.requester.toString());
// Shows your parachain's sovereign account

console.log("Source Para:", job.sourceParaId.toString());
// Shows your parachain ID (e.g., 2000)
```

### Step 6: Retrieve Results

Once the job status is "Completed", fetch the anonymized tally:

```typescript
// Get tally results
const tally = await daoApi.query.daomixVoting.tallyResults(electionId);

console.log("Results:", tally.toString());
// Example: { "CANDIDATE_A": 45, "CANDIDATE_B": 32, "CANDIDATE_C": 23 }

// Get Merkle commitments for verification
const election = await daoApi.query.daomixVoting.elections(electionId);
console.log("Input Root:", election.inputRoot.toHex());
console.log("Output Root:", election.outputRoot.toHex());

// Verify integrity
const isValid = verifyMerkleCommitments(
  inputBallots,
  outputTally,
  election.inputRoot,
  election.outputRoot
);
```

---

## Security Considerations

### 1. Sovereign Account Trust

When you submit a job via XCM, DaoChain creates the job under your parachain's **sovereign account**. This account is deterministically derived from your ParaId:

```rust
// DaoChain derives sovereign account
let sovereign = ParaId(2000).into_account_truncating();
// Results in unique account representing Parachain 2000
```

**Implications**:
- Jobs are publicly linked to your parachain (transparency)
- Only you can query jobs submitted by your sovereign account
- Results are accessible to all parachains (public verification)

### 2. XCM Barrier Validation

DaoChain only accepts MixJob submissions from **sibling parachains**, not from:
- Relay chain (centralization risk)
- Local accounts (bypasses XCM security)
- Child parachains (unverified origins)

```rust
// XCM barrier in DaoChain runtime
pub struct AllowMixJobFromSiblings;
impl Contains<(Location, Xcm<RuntimeCall>)> for AllowMixJobFromSiblings {
    fn contains((origin, xcm): &(Location, Xcm<RuntimeCall>)) -> bool {
        // Only allow: parents=1, interior=X1(Parachain(_))
        matches!(origin, Location { parents: 1, interior: Junctions::X1(_) })
    }
}
```

### 3. Ballot Privacy

- **Onion encryption**: Each ballot is encrypted with multiple layers (one per mix node + tally)
- **Unlinkability**: Mix nodes shuffle ballots, breaking voter-vote correlation
- **Verifiability**: Merkle commitments allow anyone to verify tally correctness without seeing individual votes

### 4. Weight Limits

Ensure your XCM transaction includes sufficient weight for execution:

```rust
// Minimum recommended weight
Transact {
    require_weight_at_most: Weight::from_parts(
        1_000_000_000,  // refTime (1 billion)
        65536           // proofSize (64KB)
    ),
    // ...
}
```

If weight is too low, the transaction will fail with `Barrier` error.

---

## Cost Estimation

### XCM Transaction Fees

Submitting a MixJob via XCM requires paying for:

1. **Local parachain fee**: Sending the XCM message (~0.01 DOT equivalent)
2. **DaoChain execution fee**: Processing the Transact instruction (~0.001 DOT equivalent)
3. **Mixing service fee** (optional): May be implemented in future versions

**Example**:
```rust
// Reserve 1 DOT worth of fees (adjust based on your token)
WithdrawAsset((Here, 1_000_000_000_000u128).into())  // 1 DOT = 10^12 plancks
```

### Mixing Capacity

Current limits per election:
- **Max ballots**: 10,000 per election
- **Max jobs**: 1,000 concurrent jobs across all parachains
- **Processing time**: ~30 seconds for 1,000 ballots (3 mix nodes)

---

## Example: Full Integration

Here's a complete example for a governance parachain:

```typescript
// governance-parachain/src/mixJobIntegration.ts

import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { encryptOnionBallot } from "@polokol/daomix-sdk";

export class CrossChainMixing {
  private localApi: ApiPromise;   // Your parachain
  private daoApi: ApiPromise;     // DaoChain

  async setupElection(electionId: number, voters: string[]) {
    // 1. Create election on DaoChain
    const createTx = this.daoApi.tx.daomixVoting.createElection(
      electionId,
      await this.getCurrentBlock() + 100,  // Start in 100 blocks
      await this.getCurrentBlock() + 1000  // End in 1000 blocks
    );
    await createTx.signAndSend(this.admin);

    // 2. Register voters on DaoChain
    for (const voter of voters) {
      const regTx = this.daoApi.tx.daomixVoting.registerVoter(
        electionId,
        voter
      );
      await regTx.signAndSend(this.admin);
    }
  }

  async castVote(electionId: number, voter: string, choice: string) {
    // 3. Encrypt ballot
    const encrypted = encryptOnionBallot(
      choice,
      this.senderKey,
      this.mixNodeKeys,
      this.tallyKey
    );

    // 4. Submit to DaoChain
    const castTx = this.daoApi.tx.daomixVoting.castBallot(
      electionId,
      encrypted
    );
    await castTx.signAndSend(voter);
  }

  async triggerMixing(electionId: number) {
    // 5. Send XCM to trigger mixing
    const xcm = this.buildMixJobXcm(electionId);

    const sendTx = this.localApi.tx.polkadotXcm.send(
      { V4: { parents: 1, interior: { X1: [{ Parachain: 1000 }] } } },
      xcm
    );

    await sendTx.signAndSend(this.governance);
  }

  async waitForResults(electionId: number): Promise<Record<string, number>> {
    // 6. Poll job status
    while (true) {
      const jobId = await this.daoApi.query.mixJob.lastJobForElection(electionId);
      const job = await this.daoApi.query.mixJob.jobs(jobId);

      if (job.status.isCompleted) {
        // 7. Fetch tally
        const tally = await this.daoApi.query.daomixVoting.tallyResults(electionId);
        return tally.toJSON();
      }

      await new Promise(resolve => setTimeout(resolve, 6000));  // Wait 6 seconds
    }
  }

  private buildMixJobXcm(electionId: number) {
    return this.localApi.createType("XcmVersionedXcm", {
      V4: [
        {
          WithdrawAsset: [{
            id: { parents: 0, interior: "Here" },
            fun: { Fungible: 1_000_000_000 }
          }]
        },
        {
          BuyExecution: {
            fees: { id: { parents: 0, interior: "Here" }, fun: { Fungible: 1_000_000_000 } },
            weightLimit: "Unlimited"
          }
        },
        {
          Transact: {
            originKind: "SovereignAccount",
            requireWeightAtMost: { refTime: 1_000_000_000, proofSize: 65536 },
            call: {
              encoded: this.daoApi.tx.mixJob.submitJob(electionId).method.toHex()
            }
          }
        }
      ]
    });
  }
}
```

---

## Testing

Test your integration locally before deploying to production:

```bash
# 1. Start local DaoChain
cd polkadot-sdk
./target/release/polkadot-omni-node --chain ./chain_spec.json --dev

# 2. Start mix nodes
cd mixer
npm run dev:mix-node

# 3. Run integration test
npm test -- xcm-real.e2e.test.ts
```

---

## Support & Resources

- **Documentation**: [REAL_XCM_IMPLEMENTATION.md](REAL_XCM_IMPLEMENTATION.md)
- **Implementation Status**: [XCM_IMPLEMENTATION_STATUS.md](XCM_IMPLEMENTATION_STATUS.md)
- **SDK**: `@polokol/daomix-sdk` (npm package)
- **RPC Endpoint**: `wss://daochain-rpc.polkadot.io` (production)
- **Testnet**: `wss://daochain-rpc.rococo.polkadot.io`

---

## Frequently Asked Questions

**Q: Can multiple parachains submit jobs for the same election?**
A: Yes! Multiple parachains can submit jobs for the same election. Each gets its own JobId tracked separately.

**Q: How long does mixing take?**
A: Typically 30-60 seconds for 1,000 ballots with 3 mix nodes. Scales linearly with ballot count.

**Q: Can I verify the results?**
A: Yes! Use the Merkle commitment roots stored in the Election object to cryptographically verify tally correctness.

**Q: What if my XCM message fails?**
A: Check the XCM barrier logs on DaoChain. Common issues: invalid origin (not sibling), insufficient weight, missing fees.

**Q: Is there a limit on election size?**
A: Current limit is 10,000 ballots per election. Contact the DaoMix team for higher limits.

**Q: Can I run my own mix nodes?**
A: Yes! Mix nodes are permissionless. See [mixer/README.md](mixer/README.md) for setup instructions.
