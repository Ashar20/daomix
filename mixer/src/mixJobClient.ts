/**
 * MixJob Client - Real implementation for cross-chain mixing job management
 *
 * This module provides the MixJob functionality that would normally be in the runtime pallet.
 * Since we can't rebuild the runtime due to dependency conflicts, we implement the job
 * management logic here and integrate it with the DaoChain orchestrator.
 *
 * In production, this would be replaced by the on-chain MixJob pallet.
 */

import { ApiPromise } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import type { KeyringPair } from "@polkadot/keyring/types";

export enum JobStatus {
  Pending = "Pending",
  Running = "Running",
  Completed = "Completed",
  Failed = "Failed",
}

export interface MixJobInfo {
  jobId: number;
  electionId: number;
  requester: string;  // AccountId
  sourceParaId?: number;  // If submitted via XCM
  status: JobStatus;
  createdAt: number;  // Block number
  lastUpdate: number;  // Block number
  errorCode?: string;
  resultUri?: string;
  resultHash?: string;
}

/**
 * In-memory job storage (would be on-chain in production)
 */
class MixJobStorage {
  private jobs: Map<number, MixJobInfo> = new Map();
  private nextJobId: number = 0;
  private lastJobForElection: Map<number, number> = new Map();

  submitJob(electionId: number, requester: string, sourceParaId?: number): MixJobInfo {
    const jobId = this.nextJobId++;
    const now = Date.now();

    const job: MixJobInfo = {
      jobId,
      electionId,
      requester,
      sourceParaId,
      status: JobStatus.Pending,
      createdAt: now,
      lastUpdate: now,
    };

    this.jobs.set(jobId, job);
    this.lastJobForElection.set(electionId, jobId);

    console.log(`[MixJob] Job ${jobId} submitted for election ${electionId} by ${requester}${sourceParaId ? ` (Para ${sourceParaId})` : ''}`);

    return job;
  }

  updateJobStatus(jobId: number, status: JobStatus, errorCode?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const oldStatus = job.status;
    job.status = status;
    job.lastUpdate = Date.now();
    if (errorCode) {
      job.errorCode = errorCode;
    }

    console.log(`[MixJob] Job ${jobId} status: ${oldStatus} → ${status}${errorCode ? ` (error: ${errorCode})` : ''}`);
  }

  setJobResults(jobId: number, resultUri: string, resultHash: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.resultUri = resultUri;
    job.resultHash = resultHash;
    job.lastUpdate = Date.now();

    console.log(`[MixJob] Job ${jobId} results set: ${resultUri}`);
  }

  getJob(jobId: number): MixJobInfo | undefined {
    return this.jobs.get(jobId);
  }

  getLastJobForElection(electionId: number): number | undefined {
    return this.lastJobForElection.get(electionId);
  }

  getPendingJobs(): MixJobInfo[] {
    return Array.from(this.jobs.values()).filter(j => j.status === JobStatus.Pending);
  }

  getAllJobs(): MixJobInfo[] {
    return Array.from(this.jobs.values());
  }
}

// Global job storage instance
export const mixJobStorage = new MixJobStorage();

/**
 * Submit a mixing job (simulates on-chain extrinsic)
 */
export function submitMixJob(
  electionId: number,
  requester: string | KeyringPair,
  sourceParaId?: number
): MixJobInfo {
  const requesterAddress = typeof requester === 'string' ? requester : requester.address;
  return mixJobStorage.submitJob(electionId, requesterAddress, sourceParaId);
}

/**
 * Update job status (simulates on-chain extrinsic)
 */
export function updateMixJobStatus(
  jobId: number,
  status: JobStatus,
  errorCode?: string
): void {
  mixJobStorage.updateJobStatus(jobId, status, errorCode);
}

/**
 * Set job results (simulates on-chain storage update)
 */
export function setMixJobResults(
  jobId: number,
  resultUri: string,
  resultHash: string
): void {
  mixJobStorage.setJobResults(jobId, resultUri, resultHash);
}

/**
 * Query job info (simulates on-chain storage query)
 */
export function getMixJob(jobId: number): MixJobInfo | undefined {
  return mixJobStorage.getJob(jobId);
}

/**
 * Get last job for election (simulates on-chain storage query)
 */
export function getLastJobForElection(electionId: number): number | undefined {
  return mixJobStorage.getLastJobForElection(electionId);
}

/**
 * Get all pending jobs (for orchestrator)
 */
export function getPendingMixJobs(): MixJobInfo[] {
  return mixJobStorage.getPendingJobs();
}

/**
 * Get all jobs (for debugging/monitoring)
 */
export function getAllMixJobs(): MixJobInfo[] {
  return mixJobStorage.getAllJobs();
}

/**
 * Process an XCM message that calls MixJob.submit_job
 * This simulates what the on-chain XcmExecutor would do
 */
export interface XcmMessage {
  origin: {
    parents: number;
    interior: {
      X1?: { Parachain: number };
      Here?: null;
    };
  };
  instructions: any[];
}

export function processXcmMixJobSubmission(xcm: XcmMessage, electionId: number): MixJobInfo {
  // Validate origin is sibling parachain (AllowMixJobFromSiblings barrier)
  if (xcm.origin.parents !== 1 || !xcm.origin.interior.X1) {
    throw new Error(`XCM barrier rejected: origin must be sibling parachain (parents=1, X1), got parents=${xcm.origin.parents}`);
  }

  const sourceParaId = xcm.origin.interior.X1.Parachain;
  console.log(`[XCM] Processing MixJob.submit_job from Parachain ${sourceParaId}`);

  // Convert origin to sovereign account (simplified)
  const sovereignAccount = `para_${sourceParaId}_sovereign`;

  // Submit job
  return submitMixJob(electionId, sovereignAccount, sourceParaId);
}
