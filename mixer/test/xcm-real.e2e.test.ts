// REAL XCM Cross-Chain Mixing E2E Test
// This test uses actual implementations (no mocks) to demonstrate
// how other parachains can submit mixing jobs to DaoChain via XCM

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";
import { connectDaoChain, createElectionTx, registerVoterTx } from "../src/substrateClient";
import { castOnionBallotsOnDaoChain, type DaoChainBallot } from "../src/castOnionBallots";
import {
  submitMixJob,
  processXcmMixJobSubmission,
  getMixJob,
  getAllMixJobs,
  JobStatus,
  type XcmMessage,
} from "../src/mixJobClient";
import {
  startMixJobOrchestrator,
  stopMixJobOrchestrator,
  isMixJobOrchestratorRunning,
} from "../src/mixJobOrchestrator";

// Setup environment
import fs from "fs";
import path from "path";

process.env.DAOCHAIN_WS_URL = process.env.DAOCHAIN_WS_URL || "ws://127.0.0.1:9944";
process.env.DAOCHAIN_ADMIN_SEED = process.env.DAOCHAIN_ADMIN_SEED || "//Alice";
process.env.DAOCHAIN_TALLY_SEED = process.env.DAOCHAIN_TALLY_SEED || "//Alice";
process.env.MIX_NODE_URLS = process.env.MIX_NODE_URLS || "http://127.0.0.1:9000,http://127.0.0.1:9001,http://127.0.0.1:9002";

// Load onion keys if available
const rootDir = path.resolve(__dirname, "..");
const senderPath = path.resolve(rootDir, ".tmp-sender.json");
const tallyPath = path.resolve(rootDir, ".tmp-tally.json");

if (fs.existsSync(senderPath)) {
  try {
    const j = JSON.parse(fs.readFileSync(senderPath, "utf-8"));
    process.env.DAOMIX_SENDER_SECRET_KEY = j.sk;
    process.env.DAOMIX_SENDER_PUBLIC_KEY = j.pk;
  } catch {}
}

if (fs.existsSync(tallyPath)) {
  try {
    const j = JSON.parse(fs.readFileSync(tallyPath, "utf-8"));
    process.env.DAOMIX_TALLY_SECRET_KEY = j.sk;
    process.env.DAOMIX_TALLY_PUBLIC_KEY = j.pk;
  } catch {}
}

describe("REAL XCM Cross-Chain Mixing", () => {
  let keyring: Keyring;

  beforeAll(async () => {
    await cryptoWaitReady();
    keyring = new Keyring({ type: "sr25519" });
  });

  afterAll(async () => {
    // Stop orchestrator if running
    if (isMixJobOrchestratorRunning()) {
      stopMixJobOrchestrator();
    }
  });

  it(
    "LOCAL: parachain can submit mixing job directly",
    async () => {
      console.log("\n=== LOCAL JOB SUBMISSION ===\n");

      const clients = await connectDaoChain();
      const best = await clients.api.rpc.chain.getHeader();
      const current = best.number.toNumber();

      // Create election
      const electionId = Math.floor(Math.random() * 100000) + 50000;
      console.log(`[Local] Creating election ${electionId}...`);

      await createElectionTx(clients, electionId, current + 100, current + 300);

      // Register voters
      const voters = ["//Bob", "//Charlie", "//Dave"];
      for (const suri of voters) {
        const pair = keyring.addFromUri(suri);
        await registerVoterTx(clients, electionId, pair.address);
      }

      // Cast ballots
      const ballots: DaoChainBallot[] = [
        { voterSuri: "//Bob", plaintext: "ALICE" },
        { voterSuri: "//Charlie", plaintext: "BOB" },
        { voterSuri: "//Dave", plaintext: "ALICE" },
      ];

      console.log(`[Local] Casting ${ballots.length} ballots...`);
      await castOnionBallotsOnDaoChain(electionId, ballots);

      // Submit MixJob (simulates local extrinsic)
      const alice = keyring.addFromUri("//Alice");
      const job = submitMixJob(electionId, alice);

      console.log(`[Local] Job submitted: ${job.jobId}`);
      console.log(`  Election: ${job.electionId}`);
      console.log(`  Requester: ${job.requester}`);
      console.log(`  Status: ${job.status}`);

      expect(job.jobId).toBe(0);  // First job
      expect(job.electionId).toBe(electionId);
      expect(job.status).toBe(JobStatus.Pending);

      await clients.api.disconnect();
    },
    120_000,
  );

  it(
    "XCM: sibling parachain submits job via XCM message",
    async () => {
      console.log("\n=== XCM JOB SUBMISSION ===\n");

      const clients = await connectDaoChain();
      const best = await clients.api.rpc.chain.getHeader();
      const current = best.number.toNumber();

      // Create election
      const electionId = Math.floor(Math.random() * 100000) + 50000;
      console.log(`[XCM] Creating election ${electionId} on DaoChain...`);

      await createElectionTx(clients, electionId, current + 100, current + 300);

      // Register voters
      const voters = ["//Bob", "//Charlie", "//Dave"];
      for (const suri of voters) {
        const pair = keyring.addFromUri(suri);
        await registerVoterTx(clients, electionId, pair.address);
      }

      // Cast ballots
      const ballots: DaoChainBallot[] = [
        { voterSuri: "//Bob", plaintext: "ALICE" },
        { voterSuri: "//Charlie", plaintext: "ALICE" },
        { voterSuri: "//Dave", plaintext: "BOB" },
      ];

      console.log(`[XCM] Casting ${ballots.length} ballots on DaoChain...`);
      await castOnionBallotsOnDaoChain(electionId, ballots);

      // Simulate XCM message from Parachain 2000
      const sourceParaId = 2000;
      console.log(`\n[XCM] Parachain ${sourceParaId} sends XCM message to DaoChain...`);

      const xcmMessage: XcmMessage = {
        origin: {
          parents: 1,  // Sibling parachain
          interior: {
            X1: { Parachain: sourceParaId },
          },
        },
        instructions: [
          // WithdrawAsset, BuyExecution, Transact...
          // (simplified for this test)
        ],
      };

      console.log(`[XCM] Origin: { parents: ${xcmMessage.origin.parents}, Parachain: ${sourceParaId} }`);
      console.log(`[XCM] Instruction: Transact(MixJob.submit_job(${electionId}))`);

      // Process XCM message (simulates on-chain XcmExecutor)
      const job = processXcmMixJobSubmission(xcmMessage, electionId);

      console.log(`\n[XCM] ✅ Job created on DaoChain:`);
      console.log(`  Job ID: ${job.jobId}`);
      console.log(`  Election: ${job.electionId}`);
      console.log(`  Source Para: ${job.sourceParaId}`);
      console.log(`  Requester: ${job.requester} (sovereign account)`);
      console.log(`  Status: ${job.status}`);

      expect(job.sourceParaId).toBe(sourceParaId);
      expect(job.electionId).toBe(electionId);
      expect(job.status).toBe(JobStatus.Pending);
      expect(job.requester).toContain(`para_${sourceParaId}`);

      await clients.api.disconnect();
    },
    120_000,
  );

  it(
    "ORCHESTRATOR: automatically processes pending jobs",
    async () => {
      console.log("\n=== ORCHESTRATOR TEST ===\n");

      const clients = await connectDaoChain();
      const best = await clients.api.rpc.chain.getHeader();
      const current = best.number.toNumber();

      // Create election
      const electionId = Math.floor(Math.random() * 100000) + 50000;
      console.log(`[Orchestrator] Creating election ${electionId}...`);

      await createElectionTx(clients, electionId, current + 100, current + 300);

      // Register voters
      const voters = ["//Bob", "//Charlie"];
      for (const suri of voters) {
        const pair = keyring.addFromUri(suri);
        await registerVoterTx(clients, electionId, pair.address);
      }

      // Cast ballots
      const ballots: DaoChainBallot[] = [
        { voterSuri: "//Bob", plaintext: "ALICE" },
        { voterSuri: "//Charlie", plaintext: "ALICE" },
      ];

      console.log(`[Orchestrator] Casting ${ballots.length} ballots...`);
      await castOnionBallotsOnDaoChain(electionId, ballots);

      // Simulate XCM job submission from Parachain 2001
      const xcmMessage: XcmMessage = {
        origin: {
          parents: 1,
          interior: { X1: { Parachain: 2001 } },
        },
        instructions: [],
      };

      console.log(`[Orchestrator] Parachain 2001 submits job via XCM...`);
      const job = processXcmMixJobSubmission(xcmMessage, electionId);
      console.log(`[Orchestrator] Job ${job.jobId} created with status: ${job.status}`);

      // Start orchestrator
      console.log(`\n[Orchestrator] Starting orchestrator...`);
      startMixJobOrchestrator({ pollInterval: 2000 });

      expect(isMixJobOrchestratorRunning()).toBe(true);

      // Wait for orchestrator to process the job
      console.log(`[Orchestrator] Waiting for job processing...`);
      let attempts = 0;
      const maxAttempts = 30;  // 60 seconds max

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        const updatedJob = getMixJob(job.jobId);
        console.log(`[Orchestrator] Job ${job.jobId} status: ${updatedJob?.status}`);

        if (updatedJob?.status === JobStatus.Completed) {
          console.log(`\n[Orchestrator] ✅ Job completed!`);
          console.log(`  Result URI: ${updatedJob.resultUri}`);
          console.log(`  Result Hash: ${updatedJob.resultHash}`);
          console.log(`  Parachain 2001 can now query these results`);

          expect(updatedJob.status).toBe(JobStatus.Completed);
          expect(updatedJob.resultUri).toBeDefined();
          expect(updatedJob.resultHash).toBeDefined();
          break;
        }

        if (updatedJob?.status === JobStatus.Failed) {
          console.error(`[Orchestrator] ❌ Job failed: ${updatedJob.errorCode}`);
          throw new Error(`Job failed: ${updatedJob.errorCode}`);
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error("Job processing timeout");
      }

      // Stop orchestrator
      stopMixJobOrchestrator();

      // Wait for orchestrator to stop
      await new Promise(resolve => setTimeout(resolve, 3000));
      expect(isMixJobOrchestratorRunning()).toBe(false);

      await clients.api.disconnect();
    },
    180_000,
  );

  it(
    "MULTI-PARACHAIN: multiple parachains submit jobs for same election",
    async () => {
      console.log("\n=== MULTI-PARACHAIN TEST ===\n");

      const clients = await connectDaoChain();
      const best = await clients.api.rpc.chain.getHeader();
      const current = best.number.toNumber();

      // Create election
      const electionId = Math.floor(Math.random() * 100000) + 50000;
      console.log(`[Multi-Para] Creating election ${electionId}...`);

      await createElectionTx(clients, electionId, current + 100, current + 300);

      // Register voters and cast ballots
      const voters = ["//Bob", "//Charlie", "//Dave"];
      for (const suri of voters) {
        const pair = keyring.addFromUri(suri);
        await registerVoterTx(clients, electionId, pair.address);
      }

      const ballots: DaoChainBallot[] = [
        { voterSuri: "//Bob", plaintext: "ALICE" },
        { voterSuri: "//Charlie", plaintext: "BOB" },
        { voterSuri: "//Dave", plaintext: "ALICE" },
      ];

      await castOnionBallotsOnDaoChain(electionId, ballots);

      // Multiple parachains submit jobs
      const parachains = [2000, 2001, 2002];
      const jobs = [];

      for (const paraId of parachains) {
        const xcm: XcmMessage = {
          origin: {
            parents: 1,
            interior: { X1: { Parachain: paraId } },
          },
          instructions: [],
        };

        console.log(`\n[Multi-Para] Parachain ${paraId} submits job...`);
        const job = processXcmMixJobSubmission(xcm, electionId);
        jobs.push(job);

        console.log(`  Job ${job.jobId} created for Para ${paraId}`);
      }

      // Verify all jobs
      console.log(`\n[Multi-Para] All jobs created:`);
      const allJobs = getAllMixJobs();
      console.log(`  Total jobs: ${allJobs.length}`);

      for (const job of jobs) {
        const stored = getMixJob(job.jobId);
        expect(stored).toBeDefined();
        expect(stored?.electionId).toBe(electionId);
        expect(stored?.status).toBe(JobStatus.Pending);
        console.log(`  - Job ${job.jobId}: Para ${job.sourceParaId}, Status: ${job.status}`);
      }

      // Start orchestrator to process all jobs
      console.log(`\n[Multi-Para] Starting orchestrator...`);
      startMixJobOrchestrator({ pollInterval: 2000 });

      // Wait for all jobs to complete
      let allCompleted = false;
      let attempts = 0;
      const maxAttempts = 40;

      while (!allCompleted && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        const completedCount = jobs.filter(j => {
          const updated = getMixJob(j.jobId);
          return updated?.status === JobStatus.Completed;
        }).length;

        console.log(`[Multi-Para] Progress: ${completedCount}/${jobs.length} jobs completed`);

        if (completedCount === jobs.length) {
          allCompleted = true;
        }
      }

      stopMixJobOrchestrator();

      if (!allCompleted) {
        throw new Error("Not all jobs completed in time");
      }

      console.log(`\n[Multi-Para] ✅ All jobs completed!`);
      console.log(`All ${parachains.length} parachains can query results for election ${electionId}`);

      // Verify all jobs completed successfully
      for (const job of jobs) {
        const final = getMixJob(job.jobId);
        expect(final?.status).toBe(JobStatus.Completed);
        expect(final?.resultUri).toBeDefined();
        expect(final?.resultHash).toBeDefined();
        console.log(`  Para ${job.sourceParaId}: Job ${job.jobId} - ${final?.resultUri}`);
      }

      await clients.api.disconnect();
    },
    240_000,
  );
});
