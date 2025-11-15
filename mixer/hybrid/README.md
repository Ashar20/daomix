# DaoMix + DaoChain Hybrid Script

This folder contains a **single, real end-to-end test flow** for DaoMix on DaoChain with optional hybrid post-quantum support.

It drives:

- DaoChain pallet `DaomixVoting` (create election → register voters → cast onion ballots → mix → decrypt → submit tally)
- Mix-nodes (ballot mix)
- Optional transport mix (3-hop onion for JSON-RPC)
- Optional post-quantum hybrid mode (X25519 + ML-KEM)

No mocks. Everything talks to a live Substrate node.

---

## 0. Prerequisites

### A. Build DaoChain (once)

From the **polkadot-sdk root**:

```bash
cd /path/to/polkadot-sdk

# Build runtime + node
cargo build -p parachain-template-runtime --release
cargo build -p parachain-template-node --release
```

### B. Generate DaoChain chain spec (once)

Still from polkadot-sdk root:

```bash
# WASM produced earlier:
# target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm

staging-chain-spec-builder \
  --parachain-wasm target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm \
  --para-id 2000 \
  --relay-chain dev \
  > ./chain_spec.json
```

### C. Run relay + DaoChain (dev)

In Terminal 1 (from polkadot-sdk root):

```bash
polkadot-omni-node --chain ./chain_spec.json --dev
```

You should see logs with:
- 📋 Chain specification: DaoChain
- 🧠 Parachain 2000
- Blocks being produced.

RPC endpoints:
- WebSocket: `ws://127.0.0.1:9944`
- HTTP: `http://127.0.0.1:9933`

### D. Start ballot mix-nodes

From the monorepo root (where your package.json with workspaces lives):

**Node 1 (port 4001)**
```bash
MIX_NODE_PORT=4001 \
MIX_NODE_SECRET_KEY=0x...node1_x25519_sk \
npm run dev:mix-node --workspace @polokol/mixer
```

**Node 2 (port 4002)**
```bash
MIX_NODE_PORT=4002 \
MIX_NODE_SECRET_KEY=0x...node2_x25519_sk \
npm run dev:mix-node --workspace @polokol/mixer
```

Keep these two terminals open. Each will log its X25519 public key on startup; you'll paste those into env vars below.

### E. (Optional) Start transport mix nodes

Only needed if you want JSON-RPC over onion (transport layer).

From monorepo root:

**Entry node (port 9100)**
```bash
TRANSPORT_ROLE=entry \
TRANSPORT_PORT=9100 \
TRANSPORT_SECRET_KEY=0x...entry_x25519_sk \
npm run dev:transport-node --workspace @polokol/mixer
```

**Middle node (port 9101)**
```bash
TRANSPORT_ROLE=middle \
TRANSPORT_PORT=9101 \
TRANSPORT_SECRET_KEY=0x...middle_x25519_sk \
TRANSPORT_NEXT_HOP=http://127.0.0.1:9102 \
npm run dev:transport-node --workspace @polokol/mixer
```

**Exit node (port 9102)**
```bash
TRANSPORT_ROLE=exit \
TRANSPORT_PORT=9102 \
TRANSPORT_SECRET_KEY=0x...exit_x25519_sk \
TRANSPORT_RPC_URL=http://127.0.0.1:9933 \
npm run dev:transport-node --workspace @polokol/mixer
```

Again, keep these terminals open.

---

## 1. Configure environment for the pipeline

From the monorepo root:

```bash
cd mixer/hybrid
cp .env.example .env
```

Edit `.env` and fill in:
- DaoChain WS/HTTP
- Admin / Tally / Voter seeds
- Mix-node URLs + public keys
- (Optional) Transport mix config
- (Optional) PQ flags + PQ keys

When done, source it before running:

```bash
cd /path/to/daomix
source mixer/hybrid/.env
```

---

## 2. Run the full end-to-end pipeline

From the monorepo root:

```bash
npm run build --workspace @polokol/mixer
./mixer/hybrid/run_pipeline.sh
```

This script will:

1. Check connectivity to DaoChain.
2. Run `runDaoMixDaoChain` using real config.
3. Create election (if needed).
4. Register voters on-chain.
5. Build onion ballots and cast to DaoChain.
6. Fetch ballots, run through shard+mix chain, decrypt, tally.
7. Commit Merkle roots and tallies back to DaoChain.
8. Print final tally and block hash.

---

## 3. Verify in Polkadot.js Apps

1. Open: https://polkadot.js.org/apps
2. Click Settings → Developer and set the custom endpoint to:
   - `ws://127.0.0.1:9944`
3. Go to Developer → Chain state:
   - Storage: `daomixVoting`
   - Check:
     - `elections(electionId)`
     - `ballotCount(electionId)`
     - `tallyResults(electionId)`

You should see the election, ballots, and final tally matching the pipeline output.

---

## Notes

- **Classical only**: Leave `DAOMIX_PQ_ENABLED` unset or `false`.
- **Enable hybrid PQ**: Set `DAOMIX_PQ_ENABLED=true` and configure PQ public/secret keys as per `.env.example`.
- **Enable transport mix**: Set `DAOCHAIN_TRANSPORT_ENABLED=true` and provide transport node URLs and public keys.

This script is meant for teammates: one place to look, one script to run, and clear verification steps.

