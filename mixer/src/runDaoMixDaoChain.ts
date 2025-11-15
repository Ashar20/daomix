import "dotenv/config";
import { connectDaoChain, createElectionTx, registerVoterTx } from "./substrateClient";
import { castOnionBallotsOnDaoChain, type DaoChainBallot } from "./castOnionBallots";
import { runDaoMixForElectionOnDaoChain } from "./orchestrator";
import { Keyring } from "@polkadot/keyring";
import type { ApiPromise } from "@polkadot/api";

let api: ApiPromise | null = null;

async function main() {
	try {
		// 1) Parse environment variables
		const electionIdStr = process.env.DAOCHAIN_ELECTION_ID;
		if (!electionIdStr) {
			throw new Error("DAOCHAIN_ELECTION_ID is not set");
		}
		const electionId = Number(electionIdStr);
		if (!Number.isFinite(electionId)) {
			throw new Error(`Invalid DAOCHAIN_ELECTION_ID: ${electionIdStr}`);
		}

		const voterSeedsStr = process.env.DAOCHAIN_VOTER_SEEDS;
		if (!voterSeedsStr) {
			throw new Error("DAOCHAIN_VOTER_SEEDS is not set");
		}
		const voterSeeds = voterSeedsStr
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		const voterVotesStr = process.env.DAOCHAIN_VOTER_VOTES;
		if (!voterVotesStr) {
			throw new Error("DAOCHAIN_VOTER_VOTES is not set");
		}
		const voterVotes = voterVotesStr
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		if (voterSeeds.length !== voterVotes.length) {
			throw new Error(
				`DAOCHAIN_VOTER_SEEDS length (${voterSeeds.length}) != DAOCHAIN_VOTER_VOTES length (${voterVotes.length})`,
			);
		}

		const regOffset = Number(
			process.env.DAOCHAIN_REG_DEADLINE_OFFSET || "20",
		);
		const voteOffset = Number(
			process.env.DAOCHAIN_VOTE_DEADLINE_OFFSET || "40",
		);

		console.log(`\n🎯 Starting DaoMix pipeline for election ${electionId}\n`);
		console.log(`📋 Voters: ${voterSeeds.length}`);
		console.log(`⏰ Registration deadline offset: ${regOffset} blocks`);
		console.log(`⏰ Voting deadline offset: ${voteOffset} blocks\n`);

		// 2) Connect to DaoChain
		const clients = await connectDaoChain();
		api = clients.api;

		// 3) Compute deadlines from current block
		const header = await api.rpc.chain.getHeader();
		const now = header.number.toNumber();
		const regDeadline = now + regOffset;
		const voteDeadline = now + voteOffset;

		if (voteDeadline <= regDeadline) {
			throw new Error(
				`Voting deadline (${voteDeadline}) must be > registration deadline (${regDeadline})`,
			);
		}

		console.log(`📦 Current block: ${now}`);
		console.log(`📅 Registration deadline: ${regDeadline}`);
		console.log(`📅 Voting deadline: ${voteDeadline}\n`);

		// 4) Create election if needed
		const electionStorage = await api.query.daomixVoting.elections(electionId);
		const electionExists =
			(electionStorage as any).isSome === true ||
			((electionStorage as any).isEmpty === false &&
				electionStorage !== null &&
				electionStorage !== undefined);

		if (!electionExists) {
			console.log(`📝 Creating election ${electionId}...`);
			const hash = await createElectionTx(
				clients,
				electionId,
				regDeadline,
				voteDeadline,
			);
			console.log(`✅ Election created, hash: ${hash}\n`);
		} else {
			console.log(`✅ Election ${electionId} already exists, reusing it\n`);
		}

		// 5) Derive voter accounts and register them
		console.log(`👥 Registering ${voterSeeds.length} voters...`);
		const keyring = new Keyring({ type: "sr25519" });

		for (const [index, seed] of voterSeeds.entries()) {
			const voter = keyring.addFromUri(seed);
			const vote = voterVotes[index];

			try {
				const hash = await registerVoterTx(
					clients,
					electionId,
					voter.address,
				);
				console.log(
					`  ✅ Registered voter ${index + 1}/${voterSeeds.length}: ${voter.address} (will vote: ${vote}), hash: ${hash}`,
				);
			} catch (err: any) {
				// Handle AlreadyRegistered gracefully
				if (
					err?.message?.includes("AlreadyRegistered") ||
					err?.message?.includes("already registered")
				) {
					console.log(
						`  ⚠️  Voter ${voter.address} already registered, skipping`,
					);
				} else {
					throw err;
				}
			}
		}
		console.log();

		// 6) Build DaoChainBallot[] and cast onion ballots
		console.log(`🗳️  Casting ${voterSeeds.length} onion-encrypted ballots...`);
		const ballots: DaoChainBallot[] = voterSeeds.map((suri, idx) => ({
			voterSuri: suri,
			plaintext: voterVotes[idx],
		}));

		await castOnionBallotsOnDaoChain(electionId, ballots);
		console.log();

		// 7) Run mix + tally on DaoChain
		console.log(`🔄 Running mix-chain and tally for election ${electionId}...`);
		await runDaoMixForElectionOnDaoChain(electionId);
		console.log();

		// 8) Final logging
		console.log(`🎯 DaoMix pipeline complete for election ${electionId}`);
	} catch (err) {
		console.error("DaoMix DaoChain pipeline failed:", err);
		process.exit(1);
	} finally {
		if (api && api.isConnected) {
			await api.disconnect();
		}
	}
}

void main();

