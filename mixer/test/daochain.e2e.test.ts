import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ApiPromise } from "@polkadot/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";
import fs from "fs";
import path from "path";

// Use existing helpers from the mixer workspace
import { connectDaoChain, loadTransportConfig, createElectionTx, registerVoterTx } from "../src/substrateClient";
import { runDaoMixForElectionOnDaoChain } from "../src/orchestrator";
import { castOnionBallotsOnDaoChain, type DaoChainBallot } from "../src/castOnionBallots";

// Local dev constants (overridable via env)
const ADMIN_SEED = process.env.DAOCHAIN_ADMIN_SEED || "//Alice";
const TALLY_SEED = process.env.DAOCHAIN_TALLY_SEED || "//Alice";
const VOTER_SEEDS = (process.env.DAOCHAIN_VOTER_SEEDS || "//Bob,//Charlie,//Dave").split(",");
const VOTES = (process.env.DAOCHAIN_VOTER_VOTES || "ALICE,BOB,ALICE").split(",");
const ELECTION_ID = Number(process.env.DAOCHAIN_ELECTION_ID || 42);

// Default WS endpoint (can be overridden)
process.env.DAOCHAIN_WS_URL = process.env.DAOCHAIN_WS_URL || "ws://127.0.0.1:9944";

// Enable transport for full network hopping test
process.env.DAOCHAIN_TRANSPORT_ENABLED = process.env.DAOCHAIN_TRANSPORT_ENABLED || "true";
// Disable PQ for E2E to keep wire formats classical and avoid optional branches
process.env.DAOMIX_PQ_ENABLED = process.env.DAOMIX_PQ_ENABLED || "false";

// Ensure seeds and test params are available for any early connections (beforeAll)
process.env.DAOCHAIN_ADMIN_SEED = ADMIN_SEED;
process.env.DAOCHAIN_TALLY_SEED = TALLY_SEED;
process.env.DAOCHAIN_VOTER_SEEDS = VOTER_SEEDS.join(",");
process.env.DAOCHAIN_VOTER_VOTES = VOTES.join(",");
process.env.DAOCHAIN_ELECTION_ID = String(ELECTION_ID);
process.env.MIX_NODE_URLS = process.env.MIX_NODE_URLS || "http://127.0.0.1:9000,http://127.0.0.1:9001,http://127.0.0.1:9002";

describe("DaoChain + DaoMix end-to-end", () => {
  let api: ApiPromise;

  beforeAll(async () => {
    await cryptoWaitReady();
    const clients = await connectDaoChain();
    api = clients.api;
  });

  afterAll(async () => {
    if (api) {
      await api.disconnect();
    }
  });

  it(
    "creates election, registers voters, casts onion ballots, runs mix+tally, and stores results on-chain",
    async () => {
      // Work with a mutable election id to avoid stale/expired elections in local dev
      let eid = ELECTION_ID;
      // Ensure environment for pipeline helpers
      process.env.DAOCHAIN_ADMIN_SEED = ADMIN_SEED;
      process.env.DAOCHAIN_TALLY_SEED = TALLY_SEED;
      process.env.DAOCHAIN_VOTER_SEEDS = VOTER_SEEDS.join(",");
      process.env.DAOCHAIN_VOTER_VOTES = VOTES.join(",");
      process.env.DAOCHAIN_ELECTION_ID = String(ELECTION_ID);

      // Optional: load transport config (no-op if disabled)
      const _transportCfg = loadTransportConfig();

      // 1) Metadata sanity: pallet present (case-insensitive guard)
      const pallets = api.runtimeMetadata.asLatest.pallets.map((p) => p.name.toString().toLowerCase());
      expect(pallets.includes("daomixvoting") || pallets.includes("daomix_voting")).toBe(true);

      // 2) Ensure election exists and voters registered
      const clients = await connectDaoChain();
      const best = await clients.api.rpc.chain.getHeader();
      const current = best.number.toNumber();
      const regDeadline = current + 100;
      const voteDeadline = current + 300;

      // Check if election exists and is still valid (not expired)
      const existing = await clients.api.query.daomixVoting.elections(eid);
      const exists =
        (existing as any).isSome === true ||
        ((existing as any).isEmpty === false &&
          existing !== null &&
          existing !== undefined);

      let needNewElection = false;

      if (exists) {
        // Check if deadlines have passed
        try {
          const ex = (existing as any).unwrap ? (existing as any).unwrap() : existing;
          const existingReg = ex.registration_deadline?.toNumber?.() ?? null;
          const existingVote = ex.voting_deadline?.toNumber?.() ?? null;

          // If deadlines are null or expired, create new election
          if (
            existingReg === null ||
            existingVote === null ||
            current > existingVote ||
            current > existingReg
          ) {
            console.log(`[Test] Election ${eid} has expired or invalid deadlines (current: ${current}, reg: ${existingReg}, vote: ${existingVote}). Creating new election...`);
            needNewElection = true;
          } else {
            console.log(`[Test] Reusing existing election ${eid} (current: ${current}, reg: ${existingReg}, vote: ${existingVote})`);
          }
        } catch (e) {
          console.warn(`[Test] Failed to decode election ${eid}, will create new one:`, (e as Error).message);
          needNewElection = true;
        }
      } else {
        console.log(`[Test] Election ${eid} does not exist, creating it...`);
        needNewElection = true;
      }

      if (needNewElection) {
        // find a free election id
        let candidate = Math.max(43, eid + 1);
        for (let i = 0; i < 100; i++) {
          // @ts-ignore
          const ex2 = await clients.api.query.daomixVoting.elections(candidate);
          const taken =
            (ex2 as any).isSome === true ||
            ((ex2 as any).isEmpty === false && ex2 !== null && ex2 !== undefined);
          if (!taken) {
            eid = candidate;
            break;
          }
          candidate++;
        }
        console.log(`[Test] Creating new election with ID ${eid}`);
        const best2 = await clients.api.rpc.chain.getHeader();
        const current2 = best2.number.toNumber();
        const reg2 = current2 + 100;
        const vote2 = current2 + 300;
        await createElectionTx(clients, eid, reg2, vote2);
      }
      // Register voters
      const kr = new Keyring({ type: "sr25519" });
      for (const suri of VOTER_SEEDS) {
        const pair = kr.addFromUri(suri);
        try {
          await registerVoterTx(clients, eid, pair.address);
        } catch (e: any) {
          if (!String(e?.message || e).toLowerCase().includes("already")) {
            throw e;
          }
        }
      }

      // 3) Cast onion ballots on-chain
      // Ensure onion sender/tally keys are present in env; try loading temp files if missing
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

      const ballots: DaoChainBallot[] = VOTER_SEEDS.map((suri, i) => ({
        voterSuri: suri,
        plaintext: VOTES[i] || VOTES[0],
      }));
      await castOnionBallotsOnDaoChain(eid, ballots);

      // 4) Run orchestrator (mix + tally); this function commits results on-chain and returns void
      await runDaoMixForElectionOnDaoChain(eid);

      // 5) Verify pallet storage — adjust module/keys according to metadata
      // Try camelCase module first
      // @ts-ignore - dynamic module access on api.query
      const ballotCountOpt = api.query.daomixVoting?.ballotCount
        ? await api.query.daomixVoting.ballotCount(eid)
        : // Fallback to snake_case
          // @ts-ignore
          await api.query.daomix_voting.ballotCount(eid);

      const ballotCount = (ballotCountOpt as any).toNumber ? (ballotCountOpt as any).toNumber() : Number(ballotCountOpt as any);
      expect(ballotCount).toBe(VOTES.length);

      // Tally presence
      // @ts-ignore
      const tallyOpt = api.query.daomixVoting?.tallyResults
        ? // @ts-ignore
          await api.query.daomixVoting.tallyResults(eid)
        : // @ts-ignore
          await api.query.daomix_voting.tallyResults(eid);

      // Handle Option type safely
      const isSome = (tallyOpt as any)?.isSome ?? Boolean(tallyOpt);
      expect(isSome).toBe(true);
    },
    120_000,
  );
});
