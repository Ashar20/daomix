import "dotenv/config";
import { castDemoOnionBallots } from "../servers/castOnionBallots";

async function main() {
  const idEnv = process.env.DAOMIX_ELECTION_ID || "1";
  const electionId = Number(idEnv);

  if (!Number.isFinite(electionId)) {
    throw new Error(`Invalid DAOMIX_ELECTION_ID: ${idEnv}`);
  }

  console.log(
    `\n[DaoMix] Casting demo onion ballots for election ${electionId}\n`,
  );
  await castDemoOnionBallots(electionId);
}

main().catch((err) => {
  console.error("[DaoMix] castOnionBallots demo error:", err);
  process.exit(1);
});

