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

