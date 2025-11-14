import "dotenv/config";
import { runDaoMixForElection } from "./orchestrator";

async function main() {
  const idEnv = process.env.DAOMIX_ELECTION_ID || "1";
  const electionId = Number(idEnv);

  if (!Number.isFinite(electionId)) {
    throw new Error(`Invalid DAOMIX_ELECTION_ID: ${idEnv}`);
  }

  console.log(`\n[DaoMix] Orchestrator demo for election ${electionId}\n`);
  await runDaoMixForElection(electionId);
  console.log("\n[DaoMix] Orchestrator demo finished.\n");
}

main().catch((err) => {
  console.error("[DaoMix] Orchestrator demo error:", err);
  process.exit(1);
});

