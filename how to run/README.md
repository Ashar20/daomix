# How to Run DaoChain & DaoMix

This guide covers everything you need to run the DaoChain parachain and the DaoMix privacy-preserving voting system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Running DaoChain](#running-daochain)
5. [Running DaoMix Tests](#running-daomix-tests)
6. [Cross-Chain XCM Testing](#cross-chain-xcm-testing)
7. [Environment Variables](#environment-variables)
8. [Troubleshooting](#troubleshooting)
9. [Development Notes](#development-notes)

## Prerequisites

### Required Software

- **Rust toolchain** (stable) - `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js 18+** - `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`
- **Git** - `sudo apt-get install git`

### Clone and Setup Repositories

```bash
# Clone DaoMix repository
git clone https://github.com/daomix/daomix.git
cd daomix

# Clone Polkadot SDK (for DaoChain runtime)
git clone https://github.com/paritytech/polkadot-sdk.git
cd polkadot-sdk

# Build the parachain template (DaoChain)
cargo build -p parachain-template-node --release
```

## Quick Start

### 1. Start DaoChain (One Command)

```bash
cd /Users/silas/daomix/polkadot-sdk
./target/release/polkadot-omni-node --chain ./chain_spec.json --dev --detailed-log-output --rpc-external --rpc-port 9944
```

**DaoChain will be available at:**
- **HTTP RPC:** `http://127.0.0.1:9944`
- **WebSocket:** `ws://127.0.0.1:9944`
- **Polkadot.js Apps:** Connect to `ws://127.0.0.1:9944`

### 2. Test DaoMix Integration

```bash
cd /Users/silas/daomix/mixer

# Set environment variables
export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
export DAOCHAIN_HTTP_URL=http://127.0.0.1:9944
export DAOCHAIN_ADMIN_SEED=//Alice

# Run basic tests
npm test -- test/daochain.e2e.test.ts

# Run XCM integration tests (when MixJob pallet is available)
npm test -- test/xcm-real.e2e.test.ts
```

## Detailed Setup

### Environment Setup

```bash
# Install Node.js dependencies
cd /Users/silas/daomix/mixer
npm install

# Build TypeScript
npm run build
```

### DaoChain Runtime Build

```bash
# From polkadot-sdk directory
cd /Users/silas/daomix/polkadot-sdk

# Build parachain template with MixJob pallet
cargo build -p parachain-template-node --release

# Alternative: Build the integrated version (when available)
cargo build -p polokol-runtime --release
```

## Running DaoChain

### Method 1: Polkadot Omni Node (Recommended)

This runs both relay chain and parachain in a single process:

```bash
cd /Users/silas/daomix/polkadot-sdk
./target/release/polkadot-omni-node --chain ./chain_spec.json --dev --detailed-log-output --rpc-external --rpc-port 9944
```

### Method 2: Separate Relay + Parachain (Advanced)

```bash
# Terminal 1: Start relay chain
cd /Users/silas/daomix/polkadot-sdk
./target/release/polkadot --dev --rpc-port 9933

# Terminal 2: Start parachain
cd /Users/silas/daomix/polkadot-sdk
./target/release/parachain-template-node --dev --rpc-port 9944 -- --chain rococo-local
```

### Verify DaoChain is Running

```bash
# Check RPC health
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_health","params":[]}' \
  http://127.0.0.1:9944

# Expected response:
# {"jsonrpc":"2.0","id":1,"result":{"peers":0,"isSyncing":false,"shouldHavePeers":false}}

# Check chain name
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' \
  http://127.0.0.1:9944

# Expected: {"jsonrpc":"2.0","id":1,"result":"dao-dev"}
```

## Running DaoMix Tests

### Environment Variables

Set these before running tests:

```bash
export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
export DAOCHAIN_HTTP_URL=http://127.0.0.1:9944
export DAOCHAIN_ADMIN_SEED=//Alice
export DAOCHAIN_TALLY_SEED=//Alice
export DAOCHAIN_VOTER_SEEDS=//Bob,//Charlie,//Dave
export DAOCHAIN_VOTER_VOTES=ALICE,BOB,ALICE
export DAOCHAIN_ELECTION_ID=1
```

### Basic DaoMix Test

```bash
cd /Users/silas/daomix/mixer

# Run end-to-end test
npm test -- test/daochain.e2e.test.ts
```

This will:
1. Create an election on DaoChain
2. Register voters
3. Cast encrypted ballots
4. Run the mixnet
5. Store results on-chain

### MixJob Pallet Verification

```bash
cd /Users/silas/daomix/mixer

# Check if MixJob pallet is available
npm test -- test/verify-mixjob-pallet.ts
```

### XCM Cross-Chain Tests

```bash
cd /Users/silas/daomix/mixer

# Test XCM integration logic
npm test -- test/xcm-real.e2e.test.ts
```

## Cross-Chain XCM Testing

### Prerequisites

- DaoChain running with MixJob pallet integrated
- Another parachain (or test parachain) running

### Test XCM Cross-Chain Mixing

```bash
# On a different parachain, submit mixing job to DaoChain
# This demonstrates how any parachain can use DaoChain's privacy infrastructure

# Example: Submit mixing job via XCM
pallet_xcm::execute_xcm(
    dest: DaoChain(1000),
    message: Transact(MixJob::submit_job(election_id))
);
```

### XCM Barrier Configuration

The DaoChain XCM configuration includes:

```rust
// Allow MixJob calls from sibling parachains only
pub struct AllowMixJobFromSiblings;
impl xcm_executor::traits::Contains<(xcm::latest::Location, xcm::latest::Xcm<RuntimeCall>)> for AllowMixJobFromSiblings {
    fn contains((origin, _xcm): &(xcm::latest::Location, xcm::latest::Xcm<RuntimeCall>)) -> bool {
        matches!(origin, xcm::latest::Location { parents: 1, interior: xcm::latest::Junctions::X1(_) })
    }
}
```

## Environment Variables

### Required for DaoMix

```bash
# DaoChain connection
DAOCHAIN_WS_URL=ws://127.0.0.1:9944
DAOCHAIN_HTTP_URL=http://127.0.0.1:9944

# Account seeds
DAOCHAIN_ADMIN_SEED=//Alice
DAOCHAIN_TALLY_SEED=//Alice
DAOCHAIN_VOTER_SEEDS=//Bob,//Charlie,//Dave

# Election configuration
DAOCHAIN_VOTER_VOTES=ALICE,BOB,ALICE
DAOCHAIN_ELECTION_ID=1
```

### Optional for Transport Layer

```bash
# Transport mix settings
DAOCHAIN_TRANSPORT_ENABLED=true
DAOCHAIN_TRANSPORT_ENTRY_URL=http://127.0.0.1:9100
DAOCHAIN_TRANSPORT_NODE_URLS=http://127.0.0.1:9100,http://127.0.0.1:9101,http://127.0.0.1:9102
```

### Transport Node Setup (Optional)

```bash
# Terminal 1: Exit node
TRANSPORT_ROLE=exit TRANSPORT_PORT=9102 TRANSPORT_RPC_URL=http://127.0.0.1:9944 npm run dev:transport-node

# Terminal 2: Middle node
TRANSPORT_ROLE=middle TRANSPORT_PORT=9101 TRANSPORT_NEXT_HOP=http://127.0.0.1:9102 npm run dev:transport-node

# Terminal 3: Entry node
TRANSPORT_ROLE=entry TRANSPORT_PORT=9100 TRANSPORT_NEXT_HOP=http://127.0.0.1:9101 npm run dev:transport-node
```

## Troubleshooting

### DaoChain Won't Start

**Issue:** `Invalid input: Error parsing spec file`

**Solution:** The chain spec file may be corrupted. Try regenerating:

```bash
cd /Users/silas/daomix/polkadot-sdk
./target/release/polkadot-omni-node build-spec --chain dev > chain_spec.json
```

### RPC Connection Failed

**Issue:** `curl: (7) Failed to connect to 127.0.0.1 port 9944`

**Solutions:**
1. Check if DaoChain process is running: `ps aux | grep polkadot-omni-node`
2. Verify the port: `netstat -tlnp | grep 9944`
3. Try different port: `--rpc-port 9933`

### MixJob Pallet Not Found

**Issue:** `pallet_mix_job` not available in runtime

**Solutions:**
1. Check if runtime was built with MixJob pallet
2. Rebuild with updated runtime
3. Verify pallet is in `construct_runtime!` macro

### XCM Tests Failing

**Issue:** Cross-chain calls failing

**Solutions:**
1. Ensure both chains are running
2. Verify XCM configuration in runtime
3. Check parachain registration on relay chain

### Build Errors

**Issue:** Rust compilation errors

**Common fixes:**
```bash
# Clean and rebuild
cd /Users/silas/daomix/polkadot-sdk
cargo clean
cargo build -p parachain-template-node --release

# Update Rust
rustup update stable
```

## Development Notes

### Architecture Overview

```
┌─────────────────┐    XCM     ┌─────────────────┐
│  Your Parachain │────────────│     DaoChain    │
│                 │            │                 │
│ • Governance    │            │ • MixJob Pallet │
│ • Token Voting  │            │ • Privacy Infra  │
│ • DAO Decisions │            │ • XCM Endpoints │
└─────────────────┘            └─────────────────┘
```

### Key Components

- **DaoChain:** Polkadot parachain with MixJob pallet
- **DaoMix:** TypeScript/JavaScript mixing infrastructure
- **XCM:** Cross-consensus messaging for inter-chain communication
- **MixJob Pallet:** FRAME pallet for managing mixing jobs

### Security Features

- **XCM Barriers:** Only allow MixJob calls from sibling parachains
- **Zero-knowledge proofs:** Privacy-preserving mixing
- **Encrypted ballots:** Voter privacy protection
- **Merkle commitments:** Result verification

### Performance Considerations

- MixJob pallet scales to 1000+ concurrent jobs
- Transport layer adds optional anonymity
- Sharding support for large elections
- Post-quantum cryptography for future-proofing

## Support

- **Issues:** https://github.com/daomix/daomix/issues
- **Documentation:** https://github.com/daomix/daomix/tree/main/CROSS_CHAIN_MIXING_GUIDE.md
- **Polkadot SDK:** https://github.com/paritytech/polkadot-sdk

---

**🎯 Ready to run privacy-preserving cross-chain voting on Polkadot!**

