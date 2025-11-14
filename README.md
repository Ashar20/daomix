# Polokol Monorepo

Polokol = Polkadot SDK DAO chain + DotMix mixer stack

## Overview

This monorepo contains four main components:

- **`polokol-chain`** – Substrate-based blockchain (Polkadot SDK style) with DAO voting and mixnet registry pallets
- **`mixnode`** – Node.js + TypeScript HTTP service (will become ingress/middle/egress mixer)
- **`sdk`** – TypeScript library exporting `DotMixProvider` for interacting with the mixer network
- **`dapp`** – Next.js + TypeScript demo dApp (SafeDAO UI stub)

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

**Using npm (recommended for now, due to pnpm compatibility):**
```bash
npm install
```

**Using pnpm (once upgraded to v8.15+):**
```bash
pnpm install
```

## How to Run and Test

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the mixnode** (in terminal 1):
   ```bash
   npm run dev:mixnode
   ```
   
   The mixnode will:
   - Start on port 9000
   - Use the default upstream RPC: `https://polkadot.api.onfinality.io/public`
   - Log: `[MIXNODE] Using upstream RPC: https://polkadot.api.onfinality.io/public`

3. **Start the dApp** (in terminal 2):
   ```bash
   npm run dev:dapp
   ```

4. **Open your browser** to `http://localhost:3000`

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

To point to a different Substrate/Polkadot HTTP JSON-RPC endpoint, set the `UPSTREAM_RPC_URL` environment variable before starting the mixnode:

```bash
UPSTREAM_RPC_URL=https://your-rpc-endpoint.com npm run dev:mixnode
```

Or for a local Polokol chain:
```bash
UPSTREAM_RPC_URL=http://127.0.0.1:9933 npm run dev:mixnode
```

### Development Scripts

Start the mixnode service:
```bash
# Using npm
npm run dev:mixnode

# Or directly:
npm run dev -w mixnode
```

Start the dApp:
```bash
# Using npm
npm run dev:dapp

# Or directly:
npm run dev -w dapp
```

Build all packages:
```bash
# Using npm
npm run build --workspaces

# Using pnpm
pnpm build
```

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
