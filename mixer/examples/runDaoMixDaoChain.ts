/**
 * DaoMix Full Pipeline Runner (with optional transport mix)
 *
 * This script runs the complete DaoMix pipeline:
 * 1. Creates/verifies election on DaoChain
 * 2. Registers voters
 * 3. Casts onion-encrypted ballots
 * 4. Runs mix-chain (with optional sharding) and tally
 * 5. Commits mix commitments and tally results
 *
 * SETUP (with transport mix enabled):
 *
 * 1. Start DaoChain dev (with relay) as per DaoChain README:
 *    - HTTP: http://127.0.0.1:9933
 *    - WS:   ws://127.0.0.1:9944
 *
 * 2. Start 3 transport nodes (in separate terminals), all using transportNodeServer.ts:
 *
 *    Exit node (Terminal 1):
 *      TRANSPORT_ROLE=exit TRANSPORT_PORT=9102 TRANSPORT_RPC_URL=http://127.0.0.1:9933
 *      npm run dev:transport-node --workspace @polokol/mixer
 *
 *    Middle node (Terminal 2):
 *      TRANSPORT_ROLE=middle TRANSPORT_PORT=9101 TRANSPORT_NEXT_HOP=http://127.0.0.1:9102
 *      npm run dev:transport-node --workspace @polokol/mixer
 *
 *    Entry node (Terminal 3):
 *      TRANSPORT_ROLE=entry TRANSPORT_PORT=9100 TRANSPORT_NEXT_HOP=http://127.0.0.1:9101
 *      npm run dev:transport-node --workspace @polokol/mixer
 *
 * 3. Export environment variables:
 *
 *    # DaoChain connection
 *    export DAOCHAIN_WS_URL=ws://127.0.0.1:9944
 *    export DAOCHAIN_HTTP_URL=http://127.0.0.1:9933
 *
 *    # Election setup
 *    export DAOCHAIN_ADMIN_SEED=//Alice
 *    export DAOCHAIN_TALLY_SEED=//Alice
 *    export DAOCHAIN_VOTER_SEEDS=//Bob,//Charlie,//Dave
 *    export DAOCHAIN_VOTER_VOTES=ALICE,BOB,ALICE
 *    export DAOCHAIN_ELECTION_ID=1
 *
 *    # Transport mix settings
 *    export DAOCHAIN_TRANSPORT_ENABLED=true
 *    export DAOCHAIN_TRANSPORT_ENTRY_URL=http://127.0.0.1:9100
 *    export DAOCHAIN_TRANSPORT_NODE_URLS=http://127.0.0.1:9100,http://127.0.0.1:9101,http://127.0.0.1:9102
 *    export DAOCHAIN_TRANSPORT_NODE_PUBKEYS=<comma-separated hex pubkeys from /health of each node, in same order>
 *
 *    # Optional: static sender secret key for transport layer (hex)
 *    export DAOCHAIN_TRANSPORT_SENDER_SK=<0x...>
 *
 * RUN:
 *
 *    npm run run:daochain-pipeline-transport --workspace @polokol/mixer
 *
 * EXPECTED RESULT (log-level test case):
 *
 *    In the pipeline terminal:
 *      - Log line at start: [DaoMix] Transport mix ENABLED
 *      - Standard DaoMix logs:
 *        * "Election created tx hash = 0x..."
 *        * "Registered N voters"
 *        * "Cast onion ballots"
 *        * "Sharded + mixed ballots" (if sharding enabled)
 *        * "Submitted tally with counts { ALICE: 2, BOB: 1 }" (or similar)
 *
 *    In the exit transport node logs:
 *      - Decrypted JSON-RPC bodies such as:
 *        * method: "author_submitExtrinsic"
 *        * params: ["0x<scale-encoded-extrinsic>"]
 *
 *    In the entry/middle transport node logs:
 *      - Only ciphertext sizes / onion payloads (no JSON-RPC visible)
 *
 *    In the DaoChain node logs:
 *      - Normal Substrate logs indicating extrinsics included in blocks from daomixVoting
 *
 *    In Polkadot.js Apps (optional check):
 *      - Connect to DaoChain WS (ws://127.0.0.1:9944)
 *      - Inspect storage:
 *        * daomixVoting.elections(1) exists
 *        * daomixVoting.ballotCount(1) equals number of ballots cast
 *        * daomixVoting.tallyResults(1) is populated after the run
 */

import "dotenv/config";
import {
	connectDaoChain,
	createElectionTx,
	registerVoterTx,
	loadTransportConfig,
	type TransportConfig,
} from "../src/substrate/substrateClient";
import { castOnionBallotsOnDaoChain, type DaoChainBallot } from "../servers/castOnionBallots";
import { runDaoMixForElectionOnDaoChain } from "../servers/orchestrator";
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

		// 2) Load transport config and log mode
		const transportCfg = loadTransportConfig();
		console.log(
			`[DaoMix] Transport mix ${transportCfg.enabled ? "ENABLED" : "DISABLED"}`,
		);
		if (transportCfg.enabled) {
			console.log(
				`[DaoMix] Entry node: ${transportCfg.entryNodeUrl}, RPC: ${transportCfg.rpcUrl}`,
			);
			console.log(
				`[DaoMix] Transport nodes: ${transportCfg.nodes.length} hop(s)`,
			);
		}
		console.log();

		// 3) Connect to DaoChain
		const clients = await connectDaoChain();
		api = clients.api;

		// 4) Compute deadlines from current block
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

		// 5) Create election if needed
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
				transportCfg,
			);
			console.log(
				`✅ Election created via ${transportCfg.enabled ? "transport mix" : "direct RPC"}, hash: ${hash}\n`,
			);
		} else {
			console.log(`✅ Election ${electionId} already exists, reusing it\n`);
		}

		// 6) Derive voter accounts and register them
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
					transportCfg,
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

		// 7) Build DaoChainBallot[] and cast onion ballots
		console.log(`🗳️  Casting ${voterSeeds.length} onion-encrypted ballots...`);
		const ballots: DaoChainBallot[] = voterSeeds.map((suri, idx) => ({
			voterSuri: suri,
			plaintext: voterVotes[idx],
		}));

		await castOnionBallotsOnDaoChain(electionId, ballots, transportCfg);
		console.log();

		// 8) Run mix + tally on DaoChain
		console.log(`🔄 Running mix-chain and tally for election ${electionId}...`);
		await runDaoMixForElectionOnDaoChain(electionId, transportCfg);
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

