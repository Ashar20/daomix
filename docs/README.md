# DaoMix: Cross-Chain Privacy-Preserving Voting

> **Privacy-First Governance for Polkadot Ecosystem**
> DaoMix provides a **Chaum-style mixnet** for anonymous voting across parachains.
> Any parachain can submit mixing jobs via XCM to leverage DaoMix's privacy infrastructure.

## Overview

This repository contains the complete DaoMix cross-chain mixing system:

- **`polkadot-sdk/templates/parachain`** – DaoChain parachain with DaomixVoting + MixJob pallets
- **`mixer`** – Mix-node network, orchestrator, and TypeScript SDK for onion encryption
- **`CROSS_CHAIN_MIXING_GUIDE.md`** – **Complete guide for parachains to integrate XCM-based mixing**
- **`REAL_XCM_IMPLEMENTATION.md`** – Technical proof that XCM mixing is fully implemented

## Key Features

- **Cross-Chain Mixing**: Any Polkadot parachain can submit anonymous voting jobs via XCM
- **Onion Encryption**: Multi-layer encryption with X25519 + XChaCha20-Poly1305 AEAD
- **Post-Quantum Ready**: Hybrid ML-KEM support for future-proof security
- **Verifiable Results**: Merkle commitments enable cryptographic verification of tallies
- **Decentralized Mix Nodes**: Permissionless network of shuffle nodes for unlinkability

## What's Working

- ✅ **DaoChain Parachain**: Running with DaomixVoting + MixJob pallets
- ✅ **XCM Cross-Chain Mixing**: Parachains can submit jobs via XCM (sibling-only barrier)
- ✅ **Onion Encryption**: Multi-layer X25519 + XChaCha20-Poly1305 AEAD
- ✅ **Mix-Node Network**: Decentralized shuffling with sharding support
- ✅ **Automatic Orchestrator**: Background job processing and tally submission
- ✅ **Post-Quantum Cryptography**: Hybrid ML-KEM encryption (optional)
- ✅ **Transport Mix**: Onion routing for JSON-RPC requests
- ✅ **Merkle Commitments**: Cryptographic verification of input/output integrity

## Quick Start for Parachains

**Want to integrate anonymous voting into your parachain?**

👉 **[Read the Complete Integration Guide](CROSS_CHAIN_MIXING_GUIDE.md)**

The guide covers:
- Use cases (governance voting, private polls, DAO decisions, auctions)
- Step-by-step XCM integration
- Code examples for election setup, ballot encryption, job submission
- Security considerations and cost estimation

📚 **[Full Documentation Index](DOCUMENTATION_INDEX.md)** - Find all guides organized by role and task

## 🎭 Live Demo - TWO REAL PARACHAINS

**Experience REAL cross-chain privacy - NO MOCKS, NO SIMULATIONS:**

```bash
# First time setup (5-10 minutes)
npm run demo:setup

# Start demo (every time)
npm run demo:start
```

**What you get:**
- ✅ **2 REAL Substrate parachains** (DaoChain Para 1000 + VotingChain Para 2001)
- ✅ **REAL XCM V4 messages** (cross-chain communication)
- ✅ **3 REAL mix nodes** (HTTP servers with cryptography)
- ✅ **Manual RPC entry** (educational - copy URLs from terminal to browser)
- ✅ **Live logs** (real-time streaming from actual blockchain processes)
- ✅ **Test connections** (verify real blockchain connectivity)

**Quick Start**: [DEMO_QUICKSTART.md](DEMO_QUICKSTART.md)
**Complete Guide**: [DEMO_COMPLETE.md](DEMO_COMPLETE.md)
**Technical Details**: [REAL_DEMO_COMPLETE.md](REAL_DEMO_COMPLETE.md)

## Getting Started (Development)

### Prerequisites

- Node.js 20+ (tested with v25.2.0)
- npm (comes with Node.js) or pnpm 8.15+ (for better workspace support)
- Rust (latest stable) - for building `/polokol-chain`

### Installation

**Using pnpm (preferred):**
```bash
pnpm install
```
> If pnpm 8.x on Node 25 throws `ERR_INVALID_THIS` while fetching metadata, use the npm fallback below.

**Using npm (fallback):**
```bash
npm install
```

## How to Run and Test

### Quick Start

1. **Install dependencies** (`pnpm install` or `npm install`).

2. **Start both mixnode + dApp** (single terminal):
   ```bash
   pnpm dev
   ```
   This runs `mixnode` on port `9000` and `dapp` on port `3000` in parallel.

3. **Open your browser** to `http://localhost:3000`

   The dApp will display:
   - Connection status (should show "Connected" when working)
   - Upstream RPC URL (via Mixnode)
   - Latest block number from Polkadot (e.g., "#19,234,567")
   - Raw JSON block data

### Configuring the Upstream RPC

By default, the mixnode uses:
```
UPSTREAM_RPC_URL=https://polkadot.api.onfinality.io/public
```

To point to a different Substrate/Polkadot HTTP JSON-RPC endpoint, set the `UPSTREAM_RPC_URL`
environment variable before starting the mixnode:

```bash
UPSTREAM_RPC_URL=https://your-rpc-endpoint.com pnpm dev:mixnode
```

Or for a local Polokol chain:
```bash
UPSTREAM_RPC_URL=http://127.0.0.1:9933 pnpm dev:mixnode
```

### Development Scripts

- `pnpm dev` – run mixnode + dapp together
- `pnpm dev:mixnode` – run only the mixnode
- `pnpm dev:dapp` – run only the dApp
- `pnpm build` – build all workspaces (mixnode, sdk, dapp, chain placeholder)
- `pnpm test` – run available tests/lints (currently lightweight placeholders)

### Building the Chain

From the `polokol-chain` directory:

```bash
cd polokol-chain
cargo build --release
```

To run the node in development mode:
```bash
./target/release/polokol-node --dev
```

Note: The pallets (`pallet-dao-voting` and `pallet-mixnet-registry`) are currently stubs with minimal functionality.

## Full End-to-End Flow Command

Run the complete DaoMix pipeline on DaoChain:

### Prerequisites

1. **Start DaoChain node** (see [DaoChain Dev Guide](../polkadot-sdk/docs/daochain-dev.md)):
   ```bash
   cd polkadot-sdk
   ./target/release/parachain-template-node --dev --ws-port 9944 --rpc-port 9933
   ```

2. **Start at least one mix-node**:
   ```bash
   npm run dev:mix-node --workspace @polokol/mixer
   ```

3. **Configure environment variables**:
   ```bash
   export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
   export DAOCHAIN_ADMIN_SEED=//Alice
   export DAOCHAIN_TALLY_SEED=//Alice
   export DAOCHAIN_VOTER_SEEDS=//Bob,//Charlie,//Dave
   export DAOCHAIN_VOTER_VOTES=ALICE,BOB,ALICE
   export DAOCHAIN_ELECTION_ID=1
   export DAOCHAIN_REG_DEADLINE_OFFSET=20
   export DAOCHAIN_VOTE_DEADLINE_OFFSET=40
   ```

### Run the Pipeline

Execute the full DaoMix flow:

```bash
npm run run:daochain-pipeline --workspace @polokol/mixer
```

This will:

1. ✅ Create an election on DaoChain (if it doesn't exist)
2. ✅ Register voters from `DAOCHAIN_VOTER_SEEDS`
3. ✅ Build onion-encrypted ballots and cast them to DaoChain
4. ✅ Fetch ballots from DaoChain storage
5. ✅ Send ballots through mix-nodes (`/mix` endpoints)
6. ✅ Decrypt final ciphertexts and tally votes
7. ✅ Commit mix commitments (input/output Merkle roots) to DaoChain
8. ✅ Submit final tally results to DaoChain

The pipeline completes when you see:
```
🎯 DaoMix pipeline complete for election 1
```
