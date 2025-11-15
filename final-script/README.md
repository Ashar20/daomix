# DaoMix + DaoChain – Final End-to-End Test Script

This folder contains a **single script** that your teammates can use to run the **full DaoMix pipeline** against a live DaoChain node.

It assumes:

- DaoChain (parachain) is already running with a dev relay (via `polkadot-omni-node` or your existing DaoChain README instructions).
- Mix nodes (ballot mix) are running.
- Transport nodes (network mix for RPC) are running.
- Environment variables are configured.

The script does **no mocks**. It uses the **real**:

- DaoChain pallet (`DaomixVoting`)
- Onion ballots
- Sharding + bundling
- Mix nodes
- Transport RPC mix
- Final tally on-chain

---

## 0. Pre-requisites (one-time setup)

Your teammate needs:

- **Rust + Cargo** (for DaoChain)
- **Node.js 20+** and **npm**
- **DaoMix repo** checked out (this repo)
- **Polkadot SDK / DaoChain** repo checked out and built (per your DaoChain README)
- **DaoChain node running** with relay, exposing:
  - WebSocket: `ws://127.0.0.1:9944`
  - HTTP JSON-RPC: `http://127.0.0.1:9933`

> They should follow your existing **DaoChain Dev Relay Network** instructions in the parachain README to start the node.

Example (from DaoChain README, NOT executed by this script):

```bash
# from polkadot-sdk root (example, adjust to your actual setup)
cargo build -p parachain-template-runtime --release
cargo build -p parachain-template-node --release

# build chain spec with staging-chain-spec-builder (example)
staging-chain-spec-builder build \
  --runtime=parachain-template-runtime \
  --relay-chain "dev" \
  --para-id 2000 \
  --output ./chain_spec.json

# start relay + parachain via polkadot-omni-node
polkadot-omni-node --chain ./chain_spec.json --dev
```

---

## 1. Start the mix ballot nodes (separate terminal)

From the DaoMix repo root:

```bash
# Terminal 1 – Mix node 1
MIX_NODE_SECRET_KEY=0xnode1secret \
PORT=4001 \
npm run dev:mix-node --workspace @polokol/mixer

# Terminal 2 – Mix node 2
MIX_NODE_SECRET_KEY=0xnode2secret \
PORT=4002 \
npm run dev:mix-node --workspace @polokol/mixer

# Terminal 3 – Mix node 3
MIX_NODE_SECRET_KEY=0xnode3secret \
PORT=4003 \
npm run dev:mix-node --workspace @polokol/mixer
```

Each node will log its public key on startup, something like:

```
[DaoMix] Mix node public key: 0xabc123...
```

Copy those public keys; you'll need them below.

---

## 2. Start the transport nodes (separate terminal)

These are the network-level mix nodes for JSON-RPC.

```bash
# Terminal 4 – Transport entry node
TRANSPORT_ROLE=entry \
TRANSPORT_SECRET_KEY=0xtransport1secret \
TRANSPORT_NEXT_HOP=http://127.0.0.1:9101 \
TRANSPORT_PORT=9100 \
npm run dev:transport-node --workspace @polokol/mixer

# Terminal 5 – Transport middle node
TRANSPORT_ROLE=middle \
TRANSPORT_SECRET_KEY=0xtransport2secret \
TRANSPORT_NEXT_HOP=http://127.0.0.1:9102 \
TRANSPORT_PORT=9101 \
npm run dev:transport-node --workspace @polokol/mixer

# Terminal 6 – Transport exit node
TRANSPORT_ROLE=exit \
TRANSPORT_SECRET_KEY=0xtransport3secret \
TRANSPORT_RPC_URL=http://127.0.0.1:9933 \
TRANSPORT_PORT=9102 \
npm run dev:transport-node --workspace @polokol/mixer
```

You can sanity-check them with:

```bash
curl http://127.0.0.1:9100/health
curl http://127.0.0.1:9101/health
curl http://127.0.0.1:9102/health
```

Each will return a small JSON payload with role and nodePublicKey.

Copy the transport node public keys as well.

---

## 3. Set environment variables for the pipeline

Back in a fresh terminal at the DaoMix repo root:

```bash
# --- DaoChain RPC ---
export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
export DAOCHAIN_HTTP_URL=http://127.0.0.1:9933

# --- DaoChain accounts ---
# Admin & tally authority (for demo, you can use //Alice for both)
export DAOCHAIN_ADMIN_SEED=//Alice
export DAOCHAIN_TALLY_SEED=//Alice

# Voters (Substrate dev keys)
export DAOCHAIN_VOTER_SEEDS=//Bob,//Charlie,//Dave

# Plaintext votes in order (must match number of voter seeds)
export DAOCHAIN_VOTER_VOTES=ALICE,BOB,ALICE

# Election ID and block deadlines (relative offsets)
export DAOCHAIN_ELECTION_ID=1
export DAOCHAIN_REG_DEADLINE_OFFSET=20
export DAOCHAIN_VOTE_DEADLINE_OFFSET=40

# --- Ballot Mix nodes ---
# URLs for your ballot mix nodes
export MIX_NODE_URLS=http://127.0.0.1:4001,http://127.0.0.1:4002,http://127.0.0.1:4003

# Public keys printed by the ballot mix nodes on startup, comma-separated
export MIX_NODE_PUBLIC_KEYS=0xMixNode1Pub,0xMixNode2Pub,0xMixNode3Pub

# Tally and sender keys (libsodium keypairs used for onion ballots + decrypt)
# These must match the ones you use in your existing setup or scripts.
export DAOMIX_TALLY_PUBLIC_KEY=0xTallyPubKey
export DAOMIX_TALLY_SECRET_KEY=0xTallySecretKey
export DAOMIX_SENDER_PUBLIC_KEY=0xSenderPubKey
export DAOMIX_SENDER_SECRET_KEY=0xSenderSecretKey

# --- Transport mix config ---
export DAOCHAIN_TRANSPORT_ENABLED=true
export DAOCHAIN_TRANSPORT_ENTRY_URL=http://127.0.0.1:9100
export DAOCHAIN_TRANSPORT_NODE_URLS=http://127.0.0.1:9100,http://127.0.0.1:9101,http://127.0.0.1:9102

# Comma-separated array of the transport node public keys (from /health)
export DAOCHAIN_TRANSPORT_NODE_PUBKEYS=0xTransEntryPub,0xTransMiddlePub,0xTransExitPub

# Optional: sender SK for transport onion (if not, the client may generate one internally)
export DAOCHAIN_TRANSPORT_SENDER_SK=0xTransportSenderSecretKey

# --- Sharding config (optional, uses sensible defaults if omitted) ---
export DAOMIX_SHARD_COUNT=3
export DAOMIX_BUNDLE_SIZE=10
export DAOMIX_ENABLE_SHARDING=true
```

Replace all `0x...` placeholders with real keys from your setup (you already have a working version if you've run the pipeline earlier).

---

## 4. Run the final end-to-end script

From the DaoMix repo root:

```bash
chmod +x final-script/run-daomix-e2e.sh

./final-script/run-daomix-e2e.sh
```

---

## 5. Expected behaviour

If everything is wired correctly, your teammates should see:

1. **In the pipeline terminal:**
   - Logs like:
     - Connecting to DaoChain at ws://127.0.0.1:9944
     - Transport mode: ENABLED
     - Creating election 1 (if it doesn't exist)
     - Registering voters ...
     - Casting onion ballots ...
     - Running sharded mix chain ...
     - Decrypted votes: ["ALICE","BOB","ALICE"]
     - Final tally: {"ALICE": 2, "BOB": 1}
     - setMixCommitments extrinsic submitted ...
     - submitTally extrinsic submitted ...
     - DaoMix pipeline for election 1 completed successfully.

2. **In DaoChain logs:**
   - Blocks being produced.
   - Extrinsics from DaomixVoting pallet (createElection, registerVoter, castVote, setMixCommitments, submitTally).

3. **In Polkadot.js Apps** (connected to ws://127.0.0.1:9944):
   - Under **Developer → Chain state**:
     - `DaomixVoting.Elections(1)` shows your election metadata.
     - `DaomixVoting.BallotCount(1)` is 3.
     - `DaomixVoting.TallyResults(1)` shows the final result (URI/hash).
   - Under **Developer → Extrinsics**:
     - You can see the same calls that the script did.

If something fails, the script exits with a non-zero status and prints a clear error.

---

## 6. What this script actually does

When you run:

```bash
./final-script/run-daomix-e2e.sh
```

it:

1. Builds the `@polokol/mixer` workspace (`npm run build --workspace @polokol/mixer`).
2. Runs the real pipeline:
   - Connects to DaoChain via WS.
   - Checks if election `DAOCHAIN_ELECTION_ID` exists; creates it if not.
   - Registers voters.
   - Builds onion-encrypted ballots with libsodium.
   - Shards + bundles ballots (if enabled).
   - Sends shards through the ballot mix nodes (`/mix`).
   - Decrypts final ciphertexts with tally key.
   - Computes counts and commitments (Merkle roots).
   - Submits `setMixCommitments` and `submitTally` on DaoChain.
   - Disconnects cleanly.

All of that is driven by real code in your `@polokol/mixer` workspace (no mocks).

---

That's all a teammate needs: start node(s), set env, run one script.

For convenience, the actual script is in `run-daomix-e2e.sh` below.

