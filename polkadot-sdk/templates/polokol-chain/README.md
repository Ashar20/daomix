# Polokol Chain

Substrate-based blockchain for Polokol with DAO voting and mixnet registry pallets.

## Building

From the `polokol-chain` directory:

```bash
cargo build --release
```

## Running

To run the node in development mode:

```bash
./target/release/polokol-node --dev
```

## Pallets

- **`pallet-dao-voting`** - DAO voting functionality (currently a stub)
- **`pallet-mixnet-registry`** - Mixnet node registry (currently a stub)

Both pallets are currently minimal stubs with basic storage and events. Full implementation will be added in later steps.
