# DaoChain – Local Dev & Polkadot.js Apps Setup

This guide explains how to:

1. Build and run the **DaoChain** node in local `--dev` mode.

2. Connect to it from **Polkadot.js Apps** in the browser.

---

## 1. Prerequisites

- **Rust toolchain** (stable)

- `cargo` available in your PATH

- The **Polkadot SDK repo** checked out with the DaoChain changes (renamed `parachain-template-node`, `pallet-daomix-voting` wired into the runtime)

> All commands below are run from the **Polkadot SDK repo root** where `parachain-template-node` lives.

---

## 2. Build the DaoChain node

From the Polkadot SDK repo root:

```bash
cargo build -p parachain-template-node --release
```

This produces the node binary:

```
./target/release/parachain-template-node
```

You only need to rebuild when you change the runtime or node code.

---

## 3. Run DaoChain in --dev mode

Start the node in a terminal and leave it running:

```bash
./target/release/parachain-template-node \
  --dev \
  --ws-port 9944 \
  --rpc-port 9933
```

You should see logs similar to:

- 📋 Chain specification: DaoChain
- 🏷  Local node identity is ...
- `Imported #1`, `Imported #2`, `Imported #3`, …

As long as this process is running, your DaoChain dev node is live at:

- WebSocket: `ws://127.0.0.1:9944`
- HTTP RPC: `http://127.0.0.1:9933`

Do not close this terminal while you want the chain running.

---

## 4. Quick health check (optional)

In another terminal, verify the node responds to JSON-RPC:

```bash
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_health","params":[]}' \
  http://127.0.0.1:9933
```

Expected: a JSON response containing fields like `isSyncing`, `peers`, etc.

If you get connection refused or a timeout, the node is not running or the ports differ from 9933/9944.

---

## 5. Connect DaoChain to Polkadot.js Apps

1. Open your browser and go to:

   https://polkadot.js.org/apps

2. In the top-left network selector, click and choose:

   - **Development** → **Custom**

3. In the endpoint field, enter:

   ```
   ws://127.0.0.1:9944
   ```

4. Click **Switch**.

If the connection succeeds, you should see:

- Chain name: **DaoChain**
- Block height in the top-right increasing (#1, #2, #3, …)
- Under **Developer** → **Chain state**, the `DaomixVoting` pallet is available in the dropdown.

If it stays on "waiting to establish connection":

- Confirm the node is running with `--ws-port 9944`.
- Confirm you are not behind a VPN/firewall that blocks localhost.
- Try `ws://localhost:9944` instead of `127.0.0.1`.

---

## 6. Where DaoMix fits (optional)

Once DaoChain is running and visible in Polkadot.js Apps:

- The DaoMix pipeline (`@polokol/mixer`) can connect to `ws://127.0.0.1:9944` and:
  - Create elections,
  - Register voters,
  - Cast onion-encrypted ballots,
  - Run the off-chain mix-net,
  - Commit mix commitments and final tally back to DaoChain.

d