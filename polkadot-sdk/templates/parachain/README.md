<div align="center">

# Polkadot SDK's Parachain Template

<img height="70px" alt="Polkadot SDK Logo" src="https://github.com/paritytech/polkadot-sdk/raw/master/docs/images/Polkadot_Logo_Horizontal_Pink_White.png#gh-dark-mode-only"/>
<img height="70px" alt="Polkadot SDK Logo" src="https://github.com/paritytech/polkadot-sdk/raw/master/docs/images/Polkadot_Logo_Horizontal_Pink_Black.png#gh-light-mode-only"/>

> This is a template for creating a [parachain](https://wiki.polkadot.network/docs/learn-parachains) based on Polkadot SDK.
>
> This template is automatically updated after releases in the main [Polkadot SDK monorepo](https://github.com/paritytech/polkadot-sdk).

</div>

## Table of Contents

- [Intro](#intro)

- [Template Structure](#template-structure)

- [Getting Started](#getting-started)

- [Starting a Development Chain](#starting-a-development-chain)

  - [Omni Node](#omni-node-prerequisites)
  - [Zombienet setup with Omni Node](#zombienet-setup-with-omni-node)
  - [Parachain Template Node](#parachain-template-node)
  - [Connect with the Polkadot-JS Apps Front-End](#connect-with-the-polkadot-js-apps-front-end)
  - [Takeaways](#takeaways)

- [Runtime development](#runtime-development)
- [Contributing](#contributing)
- [Getting Help](#getting-help)

## Intro

- ⏫ This template provides a starting point to build a [parachain](https://wiki.polkadot.network/docs/learn-parachains).

- ☁️ It is based on the
  [Cumulus](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/polkadot_sdk/cumulus/index.html) framework.

- 🔧 Its runtime is configured with a single custom pallet as a starting point, and a handful of ready-made pallets
  such as a [Balances pallet](https://paritytech.github.io/polkadot-sdk/master/pallet_balances/index.html).

- 👉 Learn more about parachains [here](https://wiki.polkadot.network/docs/learn-parachains)

## Template Structure

A Polkadot SDK based project such as this one consists of:

- 🧮 the [Runtime](./runtime/README.md) - the core logic of the parachain.
- 🎨 the [Pallets](./pallets/README.md) - from which the runtime is constructed.
- 💿 a [Node](./node/README.md) - the binary application, not part of the project default-members list and not compiled unless
  building the project with `--workspace` flag, which builds all workspace members, and is an alternative to
  [Omni Node](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/reference_docs/omni_node/index.html).

## Getting Started

- 🦀 The template is using the Rust language.

- 👉 Check the
  [Rust installation instructions](https://www.rust-lang.org/tools/install) for your system.

- 🛠️ Depending on your operating system and Rust version, there might be additional
  packages required to compile this template - please take note of the Rust compiler output.

Fetch parachain template code:

```sh
git clone https://github.com/paritytech/polkadot-sdk-parachain-template.git parachain-template

cd parachain-template
```

## Local Dev Setup

This section provides step-by-step instructions for building and running the parachain template locally.

### Prerequisites

Make sure you have:

- Rust toolchain (matching the version required by this SDK).
- WASM target for the runtime:

  ```bash
  rustup target add wasm32-unknown-unknown
  rustup component add rust-src
  ```

- CLI tools (installed once):

  ```bash
  cargo install --locked polkadot-omni-node
  cargo install --locked staging-chain-spec-builder
  ```

### Build the parachain runtime and node

From the `polkadot-sdk` repo root, build the runtime and node:

```bash
# Build the parachain runtime
cargo build -p parachain-template-runtime --release

# Build the parachain node
cargo build -p parachain-template-node --release
```

After building, the runtime WASM is generated under:

```
target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm
```

and the node binary at:

```
target/release/parachain-template-node
```

### Generate a dev chain spec

Use `chain-spec-builder` to create a development chain spec for this parachain runtime:

```bash
chain-spec-builder create -t development \
  --relay-chain paseo \
  --para-id 1000 \
  --runtime ./target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm \
  named-preset development \
  -o ./chain_spec.json
```

This writes `chain_spec.json` in the repo root for use with `polkadot-omni-node`.

### Run the parachain with polkadot-omni-node

Start a local dev parachain:

```bash
polkadot-omni-node --chain ./chain_spec.json --dev
```

This will:

- Run a single-node development parachain,
- Produce and finalize blocks automatically,
- Expose a WebSocket endpoint on `ws://127.0.0.1:9944` by default.

### Connect from Polkadot.js Apps

1. Open https://polkadot.js.org/apps

2. In the top-left network selector, choose a custom endpoint and set:

   ```
   ws://127.0.0.1:9944
   ```

3. Switch to that endpoint.

You should see:

- The parachain template network name in the header,
- Block numbers increasing,
- Standard pallets and the template pallet available under Developer → Chain state.

## DaoChain Dev Relay Network (with polkadot-omni-node)

This section provides instructions for running DaoChain as a parachain with a proper dev relay chain environment. This setup resolves transaction validation errors by providing the required parachain validation data.

### Prerequisites

Ensure you have the tools installed:

```bash
cargo install --locked polkadot-omni-node
cargo install --locked staging-chain-spec-builder
```

### Build the runtime

From the `polkadot-sdk` repo root, build the DaoChain runtime (only needed after code changes):

```bash
cd polkadot-sdk
cargo build -p parachain-template-runtime --release
```

The WASM binary will be generated at:

```
target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm
```

### Generate chain spec for DaoChain with dev relay

From the `polkadot-sdk` repo root, generate a chain spec that includes a synthetic dev relay chain:

```bash
cd polkadot-sdk
chain-spec-builder create \
  -t development \
  --relay-chain "dev" \
  --para-id 2000 \
  --runtime target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm \
  named-preset development > templates/parachain/chain_spec.json
```

**Notes:**
- `--relay-chain "dev"` tells `polkadot-omni-node` to spin up a synthetic dev relay chain automatically.
- `--para-id 2000` is the parachain ID used consistently for DaoChain in dev mode.
- The chain spec is written to `templates/parachain/chain_spec.json`.

### Start Omni Node as relay + DaoChain parachain

From the `polkadot-sdk` repo root, start the combined relay chain and DaoChain parachain in a single process:

```bash
cd polkadot-sdk
polkadot-omni-node \
  --chain templates/parachain/chain_spec.json \
  --dev
```

**What this does:**
- Runs both the dev relay chain and DaoChain as a parachain in a single process.
- Exposes RPC endpoints at:
  - **WebSocket:** `ws://127.0.0.1:9944`
  - **HTTP:** `http://127.0.0.1:9933`
- Produces and finalizes blocks automatically.

**In the logs, you should see:**
- `📋 Chain specification: DaoChain`
- Blocks incrementing continuously (both relay and parachain blocks).

### Connect DaoChain to Polkadot.js Apps

1. Open the Polkadot.js Apps UI in your browser: https://polkadot.js.org/apps

2. Bottom-left: Click the network name (e.g., "Polkadot" or current network) and choose "Switch".

3. Go to the "Custom" tab and set:
   - WebSocket endpoint: `ws://127.0.0.1:9944`

4. Click "Save" and "Switch".

5. Connect. You should see:
   - Network name: `DaoChain` in the header
   - Block numbers increasing every few seconds
   - Standard pallets (System, Balances, etc.)

6. Under **Developer → Extrinsics**, you should find the `daomixVoting` pallet and its extrinsics:
   - `createElection`
   - `registerVoter`
   - `castVote`
   - `setMixCommitments`
   - `submitTally`

7. Under **Developer → Chain state**, you can query:
   - `daomixVoting.elections()` - List all elections
   - `daomixVoting.ballots()` - Query ballots by election ID and index
   - `daomixVoting.ballotCount()` - Get ballot count per election

This setup provides the proper parachain validation context, allowing transactions to validate and execute successfully.

## Starting a Development Chain

The parachain template relies on a hardcoded parachain id which is defined in the runtime code
and referenced throughout the contents of this file as `{{PARACHAIN_ID}}`. Please replace
any command or file referencing this placeholder with the value of the `PARACHAIN_ID` constant:

```rust,ignore
pub const PARACHAIN_ID: u32 = 1000;
```

### Omni Node Prerequisites

[Omni Node](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/reference_docs/omni_node/index.html) can
be used to run the parachain template's runtime. `polkadot-omni-node` binary crate usage is described at a high-level
[on crates.io](https://crates.io/crates/polkadot-omni-node).

#### Install `polkadot-omni-node`

```sh
cargo install polkadot-omni-node
```

> For more advanced options, please see the installation section at [`crates.io/omni-node`](https://crates.io/crates/polkadot-omni-node).

#### Build `parachain-template-runtime`

```sh
cargo build --profile production
```

#### Install `staging-chain-spec-builder`

```sh
cargo install staging-chain-spec-builder
```

> For more advanced options, please see the installation section at [`crates.io/staging-chain-spec-builder`](https://crates.io/crates/staging-chain-spec-builder).

#### Use `chain-spec-builder` to generate the `chain_spec.json` file

```sh
chain-spec-builder create --relay-chain "rococo-local" --runtime \
    target/release/wbuild/parachain-template-runtime/parachain_template_runtime.wasm named-preset development
```

**Note**: the `relay-chain` flag is required by Omni Node. The `relay-chain` value is set in accordance
with the relay chain ID where this instantiation of parachain-template will connect to.

#### Run Omni Node

Start Omni Node with the generated chain spec. We'll start it in development mode (without a relay chain config), producing
and finalizing blocks based on manual seal, configured below to seal a block with each second.

```bash
polkadot-omni-node --chain <path/to/chain_spec.json> --dev --dev-block-time 1000
```

However, such a setup is not close to what would run in production, and for that we need to setup a local
relay chain network that will help with the block finalization. In this guide we'll setup a local relay chain
as well. We'll not do it manually, by starting one node at a time, but we'll use [zombienet](https://paritytech.github.io/zombienet/intro.html).

Follow through the next section for more details on how to do it.

### Zombienet setup with Omni Node

Assuming we continue from the last step of the previous section, we have a chain spec and we need to setup a relay chain.
We can install `zombienet` as described [here](https://paritytech.github.io/zombienet/install.html#installation), and
`zombienet-omni-node.toml` contains the network specification we want to start.

#### Relay chain prerequisites

Download the `polkadot` (and the accompanying `polkadot-prepare-worker` and `polkadot-execute-worker`) binaries from
[Polkadot SDK releases](https://github.com/paritytech/polkadot-sdk/releases). Then expose them on `PATH` like so:

```sh
export PATH="$PATH:<path/to/binaries>"
```

#### Update `zombienet-omni-node.toml` with a valid chain spec path

To simplify the process of using the parachain-template with zombienet and Omni Node, we've added a pre-configured
development chain spec (dev_chain_spec.json) to the parachain template. The zombienet-omni-node.toml file of this
template points to it, but you can update it to an updated chain spec generated on your machine. To generate a
chain spec refer to [staging-chain-spec-builder](https://crates.io/crates/staging-chain-spec-builder)

Then make the changes in the network specification like so:

```toml
# ...
[[parachains]]
id = "<PARACHAIN_ID>"
chain_spec_path = "<TO BE UPDATED WITH A VALID PATH>"
# ...
```

#### Start the network

```sh
zombienet --provider native spawn zombienet-omni-node.toml
```

### Parachain Template Node

As mentioned in the `Template Structure` section, the `node` crate is optionally compiled and it is an alternative
to `Omni Node`. Similarly, it requires setting up a relay chain, and we'll use `zombienet` once more.

#### Install the `parachain-template-node`

```sh
cargo install --path node --locked
```

#### Setup and start the network

For setup, please consider the instructions for `zombienet` installation [here](https://paritytech.github.io/zombienet/install.html#installation)
and [relay chain prerequisites](#relay-chain-prerequisites).

We're left just with starting the network:

```sh
zombienet --provider native spawn zombienet.toml
```

### Connect with the Polkadot-JS Apps Front-End

- 🌐 You can interact with your local node using the
  hosted version of the Polkadot/Substrate Portal:
  [relay chain](https://polkadot.js.org/apps/#/explorer?rpc=ws://localhost:9944)
  and [parachain](https://polkadot.js.org/apps/#/explorer?rpc=ws://localhost:9988).

- 🪐 A hosted version is also
  available on [IPFS](https://dotapps.io/).

- 🧑‍🔧 You can also find the source code and instructions for hosting your own instance in the
  [`polkadot-js/apps`](https://github.com/polkadot-js/apps) repository.

### Takeaways

Development parachains:

- 🔗 Connect to relay chains, and we showcased how to connect to a local one.
- 🧹 Do not persist the state.
- 💰 Are preconfigured with a genesis state that includes several prefunded development accounts.
- 🧑‍⚖️ Development accounts are used as validators, collators, and `sudo` accounts.

## Runtime development

We recommend using [`chopsticks`](https://github.com/AcalaNetwork/chopsticks) when the focus is more on the runtime
development and `OmniNode` is enough as is.

### Install chopsticks

To use `chopsticks`, please install the latest version according to the installation [guide](https://github.com/AcalaNetwork/chopsticks?tab=readme-ov-file#install).

### Build a raw chain spec

Build the `parachain-template-runtime` as mentioned before in this guide and use `chain-spec-builder`
again but this time by passing `--raw-storage` flag:

```sh
chain-spec-builder create --raw-storage --relay-chain "rococo-local" --runtime \
    target/release/wbuild/parachain-template-runtime/parachain_template_runtime.wasm named-preset development
```

### Start `chopsticks` with the chain spec

```sh
npx @acala-network/chopsticks@latest --chain-spec <path/to/chain_spec.json>
```

### Alternatives

`OmniNode` can be still used for runtime development if using the `--dev` flag, while `parachain-template-node` doesn't
support it at this moment. It can still be used to test a runtime in a full setup where it is started alongside a
relay chain network (see [Parachain Template node](#parachain-template-node) setup).

## Contributing

- 🔄 This template is automatically updated after releases in the main [Polkadot SDK monorepo](https://github.com/paritytech/polkadot-sdk).

- ➡️ Any pull requests should be directed to this [source](https://github.com/paritytech/polkadot-sdk/tree/master/templates/parachain).

- 😇 Please refer to the monorepo's
  [contribution guidelines](https://github.com/paritytech/polkadot-sdk/blob/master/docs/contributor/CONTRIBUTING.md) and
  [Code of Conduct](https://github.com/paritytech/polkadot-sdk/blob/master/docs/contributor/CODE_OF_CONDUCT.md).

## Getting Help

- 🧑‍🏫 To learn about Polkadot in general, [docs.Polkadot.com](https://docs.polkadot.com/) website is a good starting point.

- 🧑‍🔧 For technical introduction, [here](https://github.com/paritytech/polkadot-sdk#-documentation) are
  the Polkadot SDK documentation resources.

- 👥 Additionally, there are [GitHub issues](https://github.com/paritytech/polkadot-sdk/issues) and
  [Substrate StackExchange](https://substrate.stackexchange.com/).
- 👥You can also reach out on the [Official Polkadot discord server](https://polkadot-discord.w3f.tools/)
- 🧑Reach out on [Telegram](https://t.me/substratedevs) for more questions and discussions
