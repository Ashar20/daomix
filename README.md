# Polokol Monorepo

> **DaoMix Direction**  
> This repository is evolving into **DaoMix**, a Chaum-style mixnet for on-chain voting.  
> The current `mixnode` + `sdk` + `dapp` stack is a generic JSON-RPC path that we will
> repurpose for DaoMix flows.

Polokol = Polkadot SDK DAO chain + DotMix mixer stack

## Overview

This monorepo contains four main components:

- **`polokol-chain`** – Substrate-based chain stub for future DaoMix integration (currently unused placeholder)
- **`mixnode`** – Node.js + TypeScript JSON-RPC forwarder (ingress/middle/egress proxy)
- **`sdk`** – TypeScript library exporting `DotMixProvider` (generic JSON-RPC client)
- **`dapp`** – Next.js + TypeScript demo dApp proving the wiring (`chain_getBlock`)

## What's Working

The following features are currently functional:

- ✅ **Mixnode** forwards JSON-RPC requests to a configurable upstream RPC (default: `https://polkadot.api.onfinality.io/public`)
- ✅ **DotMixProvider SDK** wraps JSON-RPC calls and sends them through the mixnode
- ✅ **dApp** calls `chain_getBlock` via DotMixProvider → Mixnode → Public Polkadot RPC and displays live block data
- ✅ **End-to-end flow**: dApp → DotMixProvider → Mixnode → Public Substrate/Polkadot RPC → Block data

## Getting Started

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
