/**
 * MixJob Orchestrator - Automatically processes pending mixing jobs
 *
 * This orchestrator watches for pending MixJob submissions and coordinates the mixing pipeline.
 * It integrates the MixJob system with the existing DaoMix infrastructure.
 */

import {
  getPendingMixJobs,
  updateMixJobStatus,
  setMixJobResults,
  JobStatus,
  type MixJobInfo,
} from "./mixJobClient";
import { runDaoMixForElectionOnDaoChain } from "./orchestrator";
import { connectDaoChain } from "./substrateClient";

export interface OrchestratorConfig {
  pollInterval: number;  // milliseconds
  enabled: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  pollInterval: 5000,  // 5 seconds
  enabled: true,
};

let isRunning = false;
let stopRequested = false;

/**
 * Process a single pending job
 */
async function processPendingJob(job: MixJobInfo): Promise<void> {
  console.log(`\n[MixJobOrchestrator] Processing job ${job.jobId} for election ${job.electionId}`);

  try {
    // Update status to Running
    updateMixJobStatus(job.jobId, JobStatus.Running);

    // Run the mixing pipeline
    console.log(`[MixJobOrchestrator] Running DaoMix pipeline for election ${job.electionId}...`);
    await runDaoMixForElectionOnDaoChain(job.electionId);

    // Get tally results from chain
    const clients = await connectDaoChain();
    const tallyOpt = await clients.api.query.daomixVoting.tallyResults(job.electionId);

    if ((tallyOpt as any)?.isSome) {
      const tally = (tallyOpt as any).unwrap();
      const resultUri = tally.result_uri?.toString() || "unknown";
      const resultHash = tally.result_hash?.toHex() || "unknown";

      // Update job with results
      setMixJobResults(job.jobId, resultUri, resultHash);
      updateMixJobStatus(job.jobId, JobStatus.Completed);

      console.log(`[MixJobOrchestrator] ✅ Job ${job.jobId} completed successfully`);
      console.log(`  Result URI: ${resultUri}`);
      console.log(`  Result Hash: ${resultHash}`);

      // If submitted from another parachain, log success
      if (job.sourceParaId) {
        console.log(`  ↩️  Results available for Parachain ${job.sourceParaId} to query`);
      }
    } else {
      throw new Error("No tally results found after mixing");
    }

    await clients.api.disconnect();
  } catch (error) {
    console.error(`[MixJobOrchestrator] ❌ Job ${job.jobId} failed:`, error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    updateMixJobStatus(job.jobId, JobStatus.Failed, errorMsg);
  }
}

/**
 * Main orchestrator loop
 */
async function orchestratorLoop(config: OrchestratorConfig): Promise<void> {
  console.log(`[MixJobOrchestrator] Starting (poll interval: ${config.pollInterval}ms)`);

  while (!stopRequested) {
    try {
      // Get pending jobs
      const pendingJobs = getPendingMixJobs();

      if (pendingJobs.length > 0) {
        console.log(`\n[MixJobOrchestrator] Found ${pendingJobs.length} pending job(s)`);

        // Process jobs sequentially (could be parallel in production)
        for (const job of pendingJobs) {
          if (stopRequested) break;
          await processPendingJob(job);
        }
      }

      // Sleep before next poll
      if (!stopRequested) {
        await new Promise(resolve => setTimeout(resolve, config.pollInterval));
      }
    } catch (error) {
      console.error(`[MixJobOrchestrator] Loop error:`, error);
      // Continue running despite errors
      await new Promise(resolve => setTimeout(resolve, config.pollInterval));
    }
  }

  console.log(`[MixJobOrchestrator] Stopped`);
  isRunning = false;
}

/**
 * Start the MixJob orchestrator
 */
export function startMixJobOrchestrator(config: Partial<OrchestratorConfig> = {}): void {
  if (isRunning) {
    console.warn(`[MixJobOrchestrator] Already running`);
    return;
  }

  const finalConfig: OrchestratorConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log(`[MixJobOrchestrator] Disabled by config`);
    return;
  }

  isRunning = true;
  stopRequested = false;

  // Run in background (don't await)
  orchestratorLoop(finalConfig).catch(err => {
    console.error(`[MixJobOrchestrator] Fatal error:`, err);
    isRunning = false;
  });
}

/**
 * Stop the MixJob orchestrator
 */
export function stopMixJobOrchestrator(): void {
  if (!isRunning) {
    console.warn(`[MixJobOrchestrator] Not running`);
    return;
  }

  console.log(`[MixJobOrchestrator] Stopping...`);
  stopRequested = true;
}

/**
 * Check if orchestrator is running
 */
export function isMixJobOrchestratorRunning(): boolean {
  return isRunning;
}
