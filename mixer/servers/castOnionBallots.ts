import "dotenv/config";
import { TextEncoder } from "util";
import { buildOnion } from "../src/onion/onion";
import {
  initCrypto,
  fromHex,
  Keypair,
} from "../src/crypto/crypto";
import {
  loadMixNodes,
  loadOnionConfig,
} from "../src/utils/config";
import {
	connectDaoChain,
	castVoteTx,
	type TransportConfig,
} from "../src/substrate/substrateClient";

const encoder = new TextEncoder();

export interface DaoChainBallot {
	voterSuri: string;
	plaintext: string; // e.g. "ALICE", "BOB" or candidate ID
}

/**
 * Cast onion-encrypted ballots to DaoChain.
 * 
 * This function builds onion-encrypted ballots and submits them via the
 * DaomixVoting pallet's castVote extrinsic.
 * 
 * @param electionId - The election ID on DaoChain
 * @param ballots - Array of ballots with voter SURI and plaintext vote
 * @param transportConfig - Optional transport config for routing over transport mix
 */
export async function castOnionBallotsOnDaoChain(
	electionId: number,
	ballots: DaoChainBallot[],
	transportConfig?: TransportConfig,
): Promise<void> {
	await initCrypto();

	// 1) Connect to DaoChain
	const { api } = await connectDaoChain();

	try {
		// 2) Load mix-node and tally public keys for onion building
		const onionCfg = loadOnionConfig();
		const mixNodes = loadMixNodes();

		const senderSecretBytes = fromHex(onionCfg.senderSecretKey);
		const senderPublicBytes = fromHex(onionCfg.senderPublicKey);
		const senderKeypair: Keypair = {
			secretKey: senderSecretBytes,
			publicKey: senderPublicBytes,
		};

		const tallyPublicBytes = fromHex(onionCfg.tallyPublicKey);
		const mixNodePublics = mixNodes.map((n) => ({
			publicKey: fromHex(n.publicKey),
		}));

		console.log(
			`[DaoChain] Casting ${ballots.length} onion-encrypted ballots for election ${electionId}...`,
		);

		// 3) For each ballot, build onion ciphertext and submit to DaoChain
		for (const [index, ballot] of ballots.entries()) {
			// Build onion-encrypted ciphertext
			const voteBytes = encoder.encode(ballot.plaintext);
			const onionHex = await buildOnion({
				vote: voteBytes,
				mixNodes: mixNodePublics,
				tally: { publicKey: tallyPublicBytes },
				senderKeypair,
			});

			// Convert HexString to Uint8Array for Substrate
			const onionCiphertext = fromHex(onionHex);

			// Cast vote on DaoChain
			const hash = await castVoteTx(
				api,
				ballot.voterSuri,
				electionId,
				onionCiphertext,
				transportConfig,
			);

			console.log(
				`✅ [DaoChain] castVote for election ${electionId}, ballot #${index} ("${ballot.plaintext}"), hash=${hash}`,
			);
		}

		console.log(
			`[DaoChain] All ${ballots.length} ballots cast for election ${electionId}.`,
		);
	} finally {
		await api.disconnect();
	}
}

/**
 * @deprecated Use castOnionBallotsOnDaoChain instead.
 * This function is kept for backward compatibility with existing demo scripts.
 */
export async function castDemoOnionBallots(electionId: number): Promise<void> {
	// For demo purposes, create default ballots
	// In real usage, use castOnionBallotsOnDaoChain with explicit ballots
	const ballots: DaoChainBallot[] = [
		{ voterSuri: process.env.DAOCHAIN_VOTER_SEED_1 || "//Alice", plaintext: "ALICE" },
		{ voterSuri: process.env.DAOCHAIN_VOTER_SEED_2 || "//Bob", plaintext: "BOB" },
		{ voterSuri: process.env.DAOCHAIN_VOTER_SEED_3 || "//Charlie", plaintext: "ALICE" },
	];

	await castOnionBallotsOnDaoChain(electionId, ballots);
}

