# Polokol Monorepo

> **DaoMix Direction**  
> This repository is evolving into **DaoMix**, a Chaum-style mixnet for on-chain voting.  
> The current `mixnode` + `sdk` + `dapp` stack is a generic JSON-RPC path that we will
> repurpose for DaoMix flows. Any cMix/xxDK integration is optional and treated as an
> external add-on, not a core dependency.

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

## Optional: cMix Relay/Client (External)

The polokol-monorepo can optionally connect to a cMix-based RPC endpoint by running the
xx foundation [`blockchain-cmix-relay`](https://github.com/xxfoundation/blockchain-cmix-relay) repo
locally. This integration is **experimental** and **not required** for core DaoMix development.

High-level steps:

1. Clone `xxfoundation/blockchain-cmix-relay`.
2. Build `polokol-relay` and `polokol-client` (`go build` inside `blockchain/relay` and `blockchain/client`).
3. Copy `relay/networks-polkadot.example.json` to `networks.json` and configure RPC endpoints.
4. Run the relay (`./polokol-relay -p "<STATE_PASSWORD>" -n ./networks.json`) and client
   (`./polokol-client -p "<STATE_PASSWORD>" -r ../relay/relay.xxc`).
5. Point the Polokol dApp/mixnode at `http://127.0.0.1:9296/polkadot/mainnet` instead of the default upstream.

Treat this as an external dependency—use it only if you specifically need to test against the xx network mix infrastructure.
