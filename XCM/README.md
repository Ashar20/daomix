# SCM Snapshot (XCM Proof)

This folder is an isolated snapshot of the DaoMix XCM plumbing that lives inside `polkadot-sdk/templates`. 

Contents:
- `pallets/mix-job/` – full FRAME pallet for cross-chain mixing jobs (storage, extrinsics, tests)
- `runtime/configs/` – XCM router + execution config that allows sibling parachains to submit DaoMix jobs via `Transact`


