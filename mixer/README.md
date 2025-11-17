# @polokol/mixer

TypeScript crypto + onion ballot library for DaoMix (Chaum-style mixnet sidecar).

## Running the DaoChain Pipeline

The DaoMix pipeline runs on DaoChain (a Substrate parachain). Before running the pipeline, you must start DaoChain with a proper dev relay network.

### Prerequisites

1. **Start DaoChain dev relay network** (see [DaoChain README](../polkadot-sdk/templates/parachain/README.md#daochain-dev-relay-network-with-polkadot-omni-node)):
   - Follow the instructions in the DaoChain README to build the runtime, generate a chain spec with `--relay-chain "dev"`, and start `polkadot-omni-node`.
   - DaoChain should be running at `ws://127.0.0.1:9944` with both relay chain and parachain blocks being produced.

2. **Start at least one mix-node**:
   ```bash
   npm run dev:mix-node --workspace @polokol/mixer
   ```
   The mix-node should be running and accessible (default: `http://127.0.0.1:4001`).

### Environment Variables

Set the following environment variables for the pipeline:

```bash
export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
export DAOCHAIN_ADMIN_SEED=//Alice
export DAOCHAIN_TALLY_SEED=//Alice
export DAOCHAIN_VOTER_SEEDS=//Bob,//Charlie,//Dave
export DAOCHAIN_VOTER_VOTES=ALICE,BOB,ALICE
export DAOCHAIN_ELECTION_ID=1
export DAOCHAIN_REG_DEADLINE_OFFSET=20
export DAOCHAIN_VOTE_DEADLINE_OFFSET=40

# Optional: Enable sharding/bundling
export DAOMIX_ENABLE_SHARDING=true
export DAOMIX_SHARD_COUNT=3
export DAOMIX_BUNDLE_SIZE=4

# Required for mix-nodes
export MIX_NODE_URLS=http://127.0.0.1:4001
export MIX_NODE_PUBLIC_KEYS=<public-key-from-mix-node-health-endpoint>

# Required for onion encryption
export DAOMIX_TALLY_SECRET_KEY=<hex-secret-key>
export DAOMIX_TALLY_PUBLIC_KEY=<hex-public-key>
export DAOMIX_SENDER_SECRET_KEY=<hex-secret-key>
export DAOMIX_SENDER_PUBLIC_KEY=<hex-public-key>
```

### Run the Full Pipeline

Execute the complete DaoMix flow on DaoChain:

```bash
npm run run:daochain-pipeline --workspace @polokol/mixer
```

This will:
1. ✅ Connect to DaoChain at `ws://127.0.0.1:9944`
2. ✅ Create an election (if it doesn't exist)
3. ✅ Register voters from `DAOCHAIN_VOTER_SEEDS`
4. ✅ Build onion-encrypted ballots and cast them to DaoChain
5. ✅ Fetch ballots from DaoChain storage
6. ✅ **Shard and bundle ballots** (if `DAOMIX_ENABLE_SHARDING=true`)
7. ✅ Send ballots through mix-nodes (`/mix` endpoints)
8. ✅ Decrypt final ciphertexts and tally votes
9. ✅ Commit mix commitments (input/output Merkle roots) to DaoChain
10. ✅ Submit final tally results to DaoChain (including sharding metrics if enabled)

The pipeline completes when you see:
```
🎯 DaoMix pipeline complete for election 1
```

If sharding is enabled, the final result JSON will include a `sharding` section with:
- Total shards and bundles
- Bundle size statistics (min/max/avg)
- Bundle commitments (Merkle roots) for verification
- Bundle IDs for tracking

## Transport Mix (3-hop JSON-RPC over onion routing)

The transport mix provides network-level privacy by routing JSON-RPC traffic through multiple onion-encrypted hops before reaching the DaoChain RPC endpoint. This ensures that only the exit node sees the final destination and cleartext RPC payload.

### Prerequisites

#### 1. Start DaoChain / Substrate node (RPC target)

From the `polkadot-sdk` repo root, build and run the node:

```bash
cd polkadot-sdk
cargo build -p parachain-template-node --release

./target/release/parachain-template-node --dev --ws-port 9944 --rpc-port 9933
```

The node should expose:
- HTTP RPC: `http://127.0.0.1:9933`
- WebSocket RPC: `ws://127.0.0.1:9944`

**Sanity check** (optional): Verify the base RPC works:

```bash
curl -X POST http://127.0.0.1:9933 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"chain_getBlock","params":[]}'
```

If this returns a block, the base RPC is working correctly.

#### 2. Start the 3 transport mix nodes

Start each transport node in a separate terminal from the monorepo root or `mixer` directory. The nodes must be started in this order:

**Exit node** (Terminal 1 - talks to DaoChain RPC at 9933):

```bash
cd mixer

TRANSPORT_ROLE=exit \
TRANSPORT_PORT=9102 \
TRANSPORT_RPC_URL=http://127.0.0.1:9933 \
npm run dev:transport-node --workspace @polokol/mixer
```

**Middle node** (Terminal 2):

```bash
cd mixer

TRANSPORT_ROLE=middle \
TRANSPORT_PORT=9101 \
TRANSPORT_NEXT_HOP=http://127.0.0.1:9102 \
npm run dev:transport-node --workspace @polokol/mixer
```

**Entry node** (Terminal 3):

```bash
cd mixer

TRANSPORT_ROLE=entry \
TRANSPORT_PORT=9100 \
TRANSPORT_NEXT_HOP=http://127.0.0.1:9101 \
npm run dev:transport-node --workspace @polokol/mixer
```

**Health check** (verify all nodes are running):

```bash
curl http://127.0.0.1:9100/health
curl http://127.0.0.1:9101/health
curl http://127.0.0.1:9102/health
```

Each should return JSON with `role`, `publicKey`, `nextHop`, and `rpcUrl` fields. The entry and middle nodes should show their `nextHop`, while the exit node should show the `rpcUrl`.

### Run a real JSON-RPC call over the transport mix

The test script `src/runTransportRpc.ts` is already wired and can be executed from the monorepo root:

```bash
cd mixer
npm run run:transport-rpc --workspace @polokol/mixer
```

This script:
- Fetches public keys from `/health` endpoints of all three transport nodes
- Builds a 3-hop onion (exit → middle → entry) using those public keys and libsodium encryption
- Sends a real `chain_getBlock` JSON-RPC request over `/rpc-mix` on the entry node
- The exit node peels the last layer, decodes the RPC payload, and forwards to `http://127.0.0.1:9933`
- The JSON-RPC response is returned through the same path and printed

**Expected output**: The script prints the JSON-RPC response containing block data from the DaoChain node.

### What this proves

- **Real libsodium-based multi-layer onion encryption** on transport messages (same crypto as ballot onions)
- **Real 3-hop network path** (entry → middle → exit) before hitting DaoChain RPC
- **Exit node is the only component** that sees the cleartext JSON-RPC URL and body
- **No mocks**: This is a live `chain_getBlock` against a running Substrate node with real encryption and routing
- **Privacy guarantee**: Entry and middle nodes only see encrypted blobs and next-hop URLs, not the final destination or payload

