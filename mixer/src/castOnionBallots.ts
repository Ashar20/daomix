import "dotenv/config";
import { TextEncoder } from "util";
import { buildOnion } from "./onion";
import {
  initCrypto,
  fromHex,
  Keypair,
} from "./crypto";
import {
  loadMixNodes,
  loadOnionConfig,
} from "./config";
import {
	connectDaoChain,
	castVoteTx,
	type TransportConfig,
} from "./substrateClient";
import { Keyring } from "@polkadot/keyring";

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
	const keyring = new Keyring({ type: "sr25519" });

	try {
		// 2) Load mix-node and tally public keys for onion building
		const onionCfg = loadOnionConfig();
		const mixNodes = await loadMixNodes();

		const senderSecretBytes = fromHex(onionCfg.senderSecretKey);
		const senderPublicBytes = fromHex(onionCfg.senderPublicKey);
		const senderKeypair: Keypair = {
			secretKey: senderSecretBytes,
			publicKey: senderPublicBytes,
		};

		const tallyPublicBytes = fromHex(onionCfg.tallyPublicKey);
		const mixNodePublics = (mixNodes || []).map((n) => ({
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

			// Cast vote on DaoChain
			const signer = keyring.addFromUri(ballot.voterSuri);
			const hash = await castVoteTx(api, signer, electionId, onionHex, transportConfig);

			console.log(
				`✅ [DaoChain] castVote for election ${electionId}, ballot #${index} ("${ballot.plaintext}"), hash=${hash}`,
			);
			// Debug: observe storage after each cast
			try {
				const count = await (api.query as any).daomixVoting.ballotCount(electionId);
				console.log(
					"[DaoChain][Debug] ballotCount after cast from",
					signer.address,
					"is",
					count?.toString?.() ?? String(count),
				);
				const first = await (api.query as any).daomixVoting.ballots(electionId, 0);
				console.log("[DaoChain][Debug] ballots(eid, 0):", first?.toHuman?.() ?? String(first));
			} catch {
				// Also try snake_case pallet path if runtime exposes it that way
				try {
					// @ts-ignore
					const count = await (api.query as any).daomix_voting.ballotCount(electionId);
					console.log(
						"[DaoChain][Debug:snake] ballotCount after cast from",
						signer.address,
						"is",
						count?.toString?.() ?? String(count),
					);
					// @ts-ignore
					const first = await (api.query as any).daomix_voting.ballots(electionId, 0);
					console.log("[DaoChain][Debug:snake] ballots(eid, 0):", first?.toHuman?.() ?? String(first));
				} catch (e) {
					console.warn("[DaoChain][Debug] Failed to query ballotCount/ballots:", (e as Error).message);
				}
			}
		}

		// After all casts, dump any DaoMix-related events in the latest block for visibility
		try {
			const events: any[] = (await api.query.system.events()) as any;
			for (const rec of events) {
				const ev = rec.event;
				const section = ev.section?.toString?.() ?? "";
				if (section === "daomixVoting" || section === "daomix_voting") {
					console.log("[DaoChain][Events] daomixVoting:", ev.method?.toString?.(), ev.toHuman?.());
				}
			}
		} catch (e) {
			console.warn("[DaoChain][Events] Failed to read system.events:", (e as Error).message);
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

