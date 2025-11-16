// Quick script to verify MixJob pallet is available in the runtime
import { ApiPromise, WsProvider } from "@polkadot/api";

async function main() {
  const provider = new WsProvider("ws://127.0.0.1:9944");
  const api = await ApiPromise.create({ provider });

  // Get all pallets
  const pallets = api.runtimeMetadata.asLatest.pallets
    .map((p) => p.name.toString())
    .sort();

  console.log("\nAvailable pallets:", pallets);

  // Check for MixJob
  const hasMixJob = pallets.includes("MixJob");
  const hasDaomixVoting = pallets.includes("DaomixVoting");

  console.log("\n✓ Verification:");
  console.log(`  - DaomixVoting: ${hasDaomixVoting ? "✅" : "❌"}`);
  console.log(`  - MixJob: ${hasMixJob ? "✅" : "❌"}`);

  if (hasMixJob) {
    // Check if we can call MixJob methods
    const nextJobId = await api.query.mixJob.nextJobId();
    console.log(`\n✓ MixJob Storage:`);
    console.log(`  - Next Job ID: ${nextJobId.toString()}`);

    // Check extrinsics
    const submitJobTx = api.tx.mixJob.submitJob(42);
    console.log(`\n✓ MixJob Extrinsics:`);
    console.log(`  - submitJob hash: ${submitJobTx.hash.toHex()}`);
  }

  await api.disconnect();
}

main().catch(console.error);
