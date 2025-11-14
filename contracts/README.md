# @polokol/contracts

Hardhat project containing `DaoMixVoting` and related contracts for the DaoMix
on-chain voting + mixnet experiment.

## Integration Test: Onion → Mix → Decrypt

This workspace ships with a full end-to-end test (`test/DaoMix.integration.ts`)
that proves real libsodium/onion ballots can be cast, mixed, and decrypted
through the DaoMix pipeline without mocks or HTTP servers.

### What the test does

1. Spins up Hardhat’s in-process network (no external node required).
2. Deploys `DaoMixVoting` and creates a demo election.
3. Generates fresh sender, tally, and mix-node keypairs via
   `@polokol/mixer`’s libsodium bindings.
4. Builds real onion ballots for `["ALICE", "BOB", "ALICE"]` and casts them on-chain.
5. Simulates a mix-node hop entirely in-process (peel one layer + shuffle).
6. Decrypts the final ciphertexts with `decryptFinalForTally`.
7. Verifies the recovered tally is `{ ALICE: 2, BOB: 1 }`.

### Prerequisites

- Node.js ≥ 18 (Hardhat warns on v25 but still runs)
- `npm` (ships with Node)
- Repo cloned (assumes `/Users/<you>/daomix`)

### 1. Install deps (monorepo root)

```bash
cd /Users/<you>/daomix
npm install
```

### 2. Build the mixer workspace

The Hardhat test imports compiled code from `@polokol/mixer/dist`, so build it once:

```bash
npm run build --workspace @polokol/mixer
```

### 3. Run the integration test

```bash
cd contracts
npx hardhat test test/DaoMix.integration.ts
```

Expected output:

```
DaoMix end-to-end integration
  ✔ casts, mixes, decrypts, and tallies ALICE/BOB votes (…ms)
```

During the run you will also see logs for:

- `DaoMixVoting` deployment address
- Stored ballot count
- Input/output Merkle roots
- Decrypted vote list
- Tally counts

This proves the entire onion → mix → decrypt flow using the same libsodium
primitives and contract code that power the DaoMix prototype.

> Tip: If you see `MODULE_NOT_FOUND @polokol/mixer/...`, rerun the mixer build
> step. Hardhat also warns that Node 25 isn’t officially supported; if you hit
> unexpected errors, try Node 20 or 18.

