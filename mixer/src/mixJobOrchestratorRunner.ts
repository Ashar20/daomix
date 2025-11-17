import "dotenv/config";
import { startMixJobOrchestrator } from "./mixJobOrchestrator";

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const pollInterval = toNumber(process.env.MIX_JOB_POLL_INTERVAL, 5000);

  console.log(
    `[MixJobOrchestratorRunner] Starting with poll interval ${pollInterval}ms`,
  );
  startMixJobOrchestrator({ pollInterval });
  console.log("[MixJobOrchestratorRunner] Waiting for jobs (Ctrl+C to exit)...");

  // Keep process alive
  process.stdin.resume();
}

main().catch((err) => {
  console.error("[MixJobOrchestratorRunner] Fatal error:", err);
  process.exit(1);
});

