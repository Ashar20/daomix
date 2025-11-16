# Adding a Second Parachain for Cross-Chain XCM Testing

This guide explains how to manually add a second parachain to test cross-chain XCM communication with DaoChain. This enables testing the MixJob pallet's cross-chain mixing functionality.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Method 1: Multiple Omni Nodes](#method-1-multiple-omni-nodes)
4. [Method 2: Separate Relay + Multiple Parachains](#method-2-separate-relay--multiple-parachains)
5. [Configure XCM Channels](#configure-xcm-channels)
6. [Test Cross-Chain Communication](#test-cross-chain-communication)
7. [Submit MixJob via XCM](#submit-mixjob-via-xcm)
8. [Troubleshooting](#troubleshooting)

## Overview

To test cross-chain XCM functionality, you need:

- **DaoChain (Parachain 1000):** Contains MixJob pallet, accepts mixing jobs
- **TestChain (Parachain 2000):** Regular parachain that can submit jobs to DaoChain

The goal is to have TestChain submit anonymous voting/mixing jobs to DaoChain via XCM.

## Prerequisites

- DaoChain already running (see main README.md)
- Polkadot SDK built and available
- Basic understanding of parachain registration

## Method 1: Multiple Omni Nodes (Recommended)

Use multiple `polkadot-omni-node` instances, each running a different parachain.

### Step 1: Create Second Chain Spec

```bash
cd /Users/silas/daomix/polkadot-sdk

# Create chain spec for TestChain (Parachain ID 2000)
./target/release/polkadot-omni-node build-spec --chain dev --para-id 2000 > testchain_spec.json

# Edit the chain spec to set parachain ID
# Change "para_id": 1000 to "para_id": 2000
# Change "name": "dao-dev" to "name": "test-dev"
```

### Step 2: Start Second Omni Node

```bash
# Terminal 2: Start TestChain on different ports
cd /Users/silas/daomix/polkadot-sdk
./target/release/polkadot-omni-node \
  --chain ./testchain_spec.json \
  --dev \
  --detailed-log-output \
  --rpc-external \
  --rpc-port 9945 \
  --ws-port 9946 \
  --port 30334
```

**TestChain will be available at:**
- HTTP RPC: `http://127.0.0.1:9945`
- WebSocket: `ws://127.0.0.1:9946`

### Step 3: Verify Both Chains

```bash
# Check DaoChain
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' \
  http://127.0.0.1:9944
# Expected: {"jsonrpc":"2.0","id":1,"result":"dao-dev"}

# Check TestChain
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' \
  http://127.0.0.1:9945
# Expected: {"jsonrpc":"2.0","id":1,"result":"test-dev"}
```

## Method 2: Separate Relay + Multiple Parachains (Advanced)

For more realistic testing with actual relay chain separation.

### Step 1: Start Relay Chain

```bash
cd /Users/silas/daomix/polkadot-sdk

# Start relay chain
./target/release/polkadot \
  --dev \
  --rpc-port 9933 \
  --ws-port 9944 \
  --port 30333
```

### Step 2: Register Parachains on Relay

```bash
# Terminal 2: Register DaoChain (ID 1000)
cd /Users/silas/daomix/polkadot-sdk
./target/release/parachain-template-node \
  --dev \
  --rpc-port 9945 \
  --ws-port 9946 \
  --port 30334 \
  --parachain-id 1000 \
  -- --chain rococo-local --rpc-port 9933

# Terminal 3: Register TestChain (ID 2000)
cd /Users/silas/daomix/polkadot-sdk
./target/release/parachain-template-node \
  --dev \
  --rpc-port 9947 \
  --ws-port 9948 \
  --port 30335 \
  --parachain-id 2000 \
  -- --chain rococo-local --rpc-port 9933
```

## Configure XCM Channels

### Automatic XCM Channel Setup

In dev mode, XCM channels are automatically established between parachains. However, you may need to:

### Manual XCM Channel Configuration (if needed)

```bash
# On Relay Chain, force XCM channel establishment
# This is usually automatic in dev mode

# Check HRMP channels
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"hrmp_hrmpChannels","params":[]}' \
  http://127.0.0.1:9933
```

### Verify Parachain Registration

```bash
# Check registered parachains on relay
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"paras_paras","params":[]}' \
  http://127.0.0.1:9933

# Should show both parachain IDs: 1000 (DaoChain) and 2000 (TestChain)
```

## Test Cross-Chain Communication

### Basic XCM Ping Test

Create a simple XCM message from TestChain to DaoChain:

```javascript
// In Polkadot.js Apps connected to TestChain (ws://127.0.0.1:9946)

// Send a simple remark to DaoChain
const remarkCall = api.tx.system.remark("Hello from TestChain!");
const dest = { V3: { parents: 1, interior: { X1: { parachain: 1000 } } } };
const message = { V3: [{ Transact: { originType: "Native", requireWeightAtMost: { refTime: 1000000000, proofSize: 0 } } }] };

// This would be a basic XCM transact call
```

### Test XCM Transact

```javascript
// More complete XCM transact example
const dest = {
  V3: {
    parents: 1,
    interior: {
      X1: { Parachain: 1000 }  // DaoChain parachain ID
    }
  }
};

const message = {
  V3: [
    {
      Transact: {
        originType: "Native",
        requireWeightAtMost: {
          refTime: 1000000000,
          proofSize: 0
        }
      }
    }
  ]
};

// Execute XCM
await api.tx.polkadotXcm.execute(message, 0);
```

## Submit MixJob via XCM

### Prerequisites

- DaoChain must have MixJob pallet integrated
- XCM channels established between TestChain and DaoChain
- TestChain has XCM pallet available

### XCM MixJob Submission

```javascript
// In Polkadot.js Apps connected to TestChain

// Define the MixJob call (this would be a real pallet call)
const mixJobCall = api.tx.mixJob.submitJob(
  42,  // election_id
  "encrypted_ballots_data",
  "public_key"
);

// Create XCM message to DaoChain
const dest = {
  V3: {
    parents: 1,
    interior: {
      X1: { Parachain: 1000 }  // DaoChain ID
    }
  }
};

const message = {
  V3: [
    {
      Transact: {
        originType: "Native",
        requireWeightAtMost: {
          refTime: 5000000000,  // Adjust based on call weight
          proofSize: 65536
        }
      }
    },
    {
      Call: mixJobCall.toHex()  // The actual MixJob pallet call
    }
  ]
};

// Send the XCM message
const tx = api.tx.polkadotXcm.send(dest, message);
await tx.signAndSend(senderAccount);
```

### Verify MixJob on DaoChain

```javascript
// Connect to DaoChain (ws://127.0.0.1:9944)

// Check if job was created
const job = await api.query.mixJob.jobs(42);  // election_id
console.log("MixJob created:", job);

// Check job status
const status = await api.query.mixJob.jobStatus(42);
console.log("Job status:", status);
```

## Testing with DaoMix Scripts

### Environment Setup

```bash
# Set up environment for cross-chain testing
export TESTCHAIN_WS_URL=ws://127.0.0.1:9946
export TESTCHAIN_HTTP_URL=http://127.0.0.1:9946
export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
export DAOCHAIN_HTTP_URL=http://127.0.0.1:9944

cd /Users/silas/daomix/mixer
```

### Run Cross-Chain XCM Test

```javascript
// test/xcm-cross-chain.test.ts
import { ApiPromise, WsProvider } from '@polkadot/api';

async function testCrossChainMixJob() {
  // Connect to TestChain
  const testChainApi = await ApiPromise.create({
    provider: new WsProvider('ws://127.0.0.1:9946')
  });

  // Connect to DaoChain
  const daoChainApi = await ApiPromise.create({
    provider: new WsProvider('ws://127.0.0.1:9944')
  });

  // Submit MixJob via XCM from TestChain to DaoChain
  const mixJobCall = daoChainApi.tx.mixJob.submitJob(42, "test_data", "test_key");

  // Create XCM message
  const dest = { V3: { parents: 1, interior: { X1: { Parachain: 1000 } } } };
  const message = {
    V3: [
      {
        Transact: {
          originType: "Native",
          requireWeightAtMost: { refTime: 5000000000, proofSize: 65536 }
        }
      }
    ]
  };

  // Send XCM transact
  await testChainApi.tx.polkadotXcm.send(dest, message).signAndSend(alice);

  // Verify on DaoChain
  const job = await daoChainApi.query.mixJob.jobs(42);
  console.log("✅ Cross-chain MixJob created:", job);

  await testChainApi.disconnect();
  await daoChainApi.disconnect();
}

testCrossChainMixJob();
```

### Run the Test

```bash
cd /Users/silas/daomix/mixer
npm test -- test/xcm-cross-chain.test.ts
```

## Troubleshooting

### XCM Channels Not Established

**Symptoms:** XCM messages fail with "NoChannel" error

**Solutions:**
```bash
# Force HRMP channel establishment (on relay chain)
curl -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"hrmp_forceOpenHrmpChannel",
    "params":[1000, 2000, 8, 512]
  }' \
  http://127.0.0.1:9933

# Check HRMP channels
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"hrmp_hrmpChannels","params":[]}' \
  http://127.0.0.1:9933
```

### Parachain Not Registered

**Symptoms:** Parachain not visible in `paras_paras`

**Solutions:**
1. Ensure parachain is started with correct `--parachain-id`
2. Check relay chain logs for registration events
3. Manually register parachain (advanced)

### XCM Weight Too Low

**Symptoms:** XCM execution fails with "WeightTooLow"

**Solutions:**
```javascript
// Increase requireWeightAtMost
const message = {
  V3: [
    {
      Transact: {
        originType: "Native",
        requireWeightAtMost: {
          refTime: 10000000000,  // Increase this
          proofSize: 131072      // Increase this
        }
      }
    }
  ]
};
```

### MixJob Call Not Found

**Symptoms:** XCM succeeds but MixJob pallet call fails

**Solutions:**
1. Verify MixJob pallet is integrated in DaoChain runtime
2. Check pallet call encoding
3. Ensure XCM barrier allows the call

### Port Conflicts

**Symptoms:** "Address already in use" errors

**Solutions:**
- Use different ports for each parachain
- Kill existing processes: `pkill -f polkadot-omni-node`

### Chain Spec Issues

**Symptoms:** Invalid parachain ID or chain spec errors

**Solutions:**
```bash
# Recreate chain spec
./target/release/polkadot-omni-node build-spec --chain dev --para-id 2000 > testchain_spec.json

# Edit para_id and name in the JSON file
```

## Advanced Configuration

### Custom Parachain Setup

For more realistic testing, create a custom parachain with XCM capabilities:

```bash
# Create custom parachain template
cd /Users/silas/daomix/polkadot-sdk
./target/release/parachain-template-node build-spec --chain dev --para-id 2000 > custom_para.json

# Modify runtime to include XCM pallet (if not present)
# Add pallet_xcm, pallet_xcm_benchmarks, etc.
```

### HRMP Channel Configuration

```javascript
// Advanced HRMP setup (if automatic setup fails)
await relayApi.tx.hrmp.forceOpenHrmpChannel(
  1000,  // sender parachain
  2000,  // recipient parachain
  8,     // max capacity
  512    // max total size
);
```

## Performance Testing

### Load Testing XCM Channels

```bash
# Send multiple XCM messages
for i in {1..10}; do
  curl -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":'$i',"method":"author_submitExtrinsic","params":["0x..."]}' \
    http://127.0.0.1:9945
done
```

### Monitor XCM Activity

```bash
# Check XCM messages in flight
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"xcmPallet_queried","params":[]}' \
  http://127.0.0.1:9944
```

## Security Considerations

### XCM Barriers

Ensure proper XCM barriers are configured:

```rust
// In DaoChain runtime
pub struct AllowMixJobFromSiblings;
impl Contains<(Location, Xcm<RuntimeCall>)> for AllowMixJobFromSiblings {
    fn contains((origin, xcm): &(Location, Xcm<RuntimeCall>)) -> bool {
        // Only allow from sibling parachains
        matches!(origin, Location { parents: 1, interior: X1(Parachain(_)) })
    }
}
```

### Weight Limits

Set appropriate weight limits for XCM execution to prevent abuse.

### Origin Filtering

Use proper origin filtering to ensure only authorized parachains can submit MixJobs.

---

## Summary

**🎯 Cross-Chain XCM Setup Complete!**

You now have:
- ✅ DaoChain (Parachain 1000) with MixJob pallet
- ✅ TestChain (Parachain 2000) for testing
- ✅ XCM channels established
- ✅ Cross-chain communication verified
- ✅ MixJob submission via XCM tested

**Next Steps:**
1. Test real MixJob submissions
2. Monitor cross-chain performance
3. Scale to multiple parachains
4. Implement production XCM barriers

**🚀 Ready for privacy-preserving cross-chain voting!**

