import "dotenv/config";
import { ApiPromise, WsProvider } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { Keyring } from "@polkadot/keyring";
import type { KeyringPair } from "@polkadot/keyring/types";
import {
	sendRpcOverTransportMix,
	type TransportNode,
} from "./transportClient";

// Re-export TransportNode with PQ support
export type { TransportNode };
import type { HexString } from "./shared";

export interface DaoChainClients {
	api: ApiPromise;
	admin: ReturnType<Keyring["addFromUri"]>;
	tally: ReturnType<Keyring["addFromUri"]>;
}

const DEFAULT_WS = "ws://127.0.0.1:9944";

export interface TransportConfig {
	enabled: boolean;
	entryNodeUrl: string;
	rpcUrl: string; // DaoChain HTTP endpoint the exit node will talk to (e.g., http://127.0.0.1:9933)
	nodes: TransportNode[]; // in hop order: [entry, middle?, exit]
	senderSecretKeyHex?: string;
}

export function loadTransportConfig(): TransportConfig {
	const enabled = process.env.DAOCHAIN_TRANSPORT_ENABLED === "true";

	const entryNodeUrl = process.env.DAOCHAIN_TRANSPORT_ENTRY_URL || "";
	const rpcUrl = process.env.DAOCHAIN_HTTP_URL || "http://127.0.0.1:9933";

	const nodeUrls = (process.env.DAOCHAIN_TRANSPORT_NODE_URLS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const nodePks = (process.env.DAOCHAIN_TRANSPORT_NODE_PUBKEYS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	const nodes: TransportNode[] = [];
	for (let i = 0; i < nodeUrls.length && i < nodePks.length; i++) {
		nodes.push({ url: nodeUrls[i], publicKey: nodePks[i] as HexString });
	}

	// Optional PQ public keys for transport nodes
	const pqPubKeysEnv = process.env.DAOCHAIN_TRANSPORT_NODE_PQ_PUBKEYS;
	if (pqPubKeysEnv && enabled) {
		const pqHexStrings = pqPubKeysEnv
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		if (pqHexStrings.length !== nodes.length) {
			console.warn(
				`DAOCHAIN_TRANSPORT_NODE_PQ_PUBKEYS length (${pqHexStrings.length}) does not match transport nodes (${nodes.length}). PQ will be disabled for nodes without PQ keys.`,
			);
		}

		for (let i = 0; i < nodes.length && i < pqHexStrings.length; i++) {
			const hex = pqHexStrings[i];
			if (hex) {
				const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
				nodes[i].pqPublicKey = new Uint8Array(Buffer.from(normalized, "hex"));
			}
		}
	}

	return {
		enabled,
		entryNodeUrl,
		rpcUrl,
		nodes,
		senderSecretKeyHex: process.env.DAOCHAIN_TRANSPORT_SENDER_SK || undefined,
	};
}

/**
 * Submit an extrinsic, optionally over transport mix.
 *
 * @param api - ApiPromise instance
 * @param signer - KeyringPair to sign the extrinsic
 * @param extrinsic - SubmittableExtrinsic to submit
 * @param transportConfig - Optional transport config (if not provided, loads from env)
 * @returns Transaction hash (hex string)
 */
export async function submitExtrinsic(
	api: ApiPromise,
	signer: KeyringPair,
	extrinsic: SubmittableExtrinsic<"promise">,
	transportConfig?: TransportConfig,
): Promise<string> {
	// If transport is not enabled or misconfigured, fall back to direct signAndSend
	const cfg = transportConfig ?? loadTransportConfig();
	const useTransport =
		cfg.enabled && cfg.entryNodeUrl && cfg.nodes.length > 0;

	if (!useTransport) {
		return new Promise<string>((resolve, reject) => {
			let resolved = false;
			extrinsic
				.signAndSend(signer, ({ status, dispatchError }) => {
					if (resolved) {
						return;
					}
					if (dispatchError) {
						resolved = true;
						reject(new Error(dispatchError.toString()));
					} else if (status.isInBlock) {
						resolved = true;
						resolve(status.asInBlock.toHex());
					}
				})
				.catch((err) => {
					if (!resolved) {
						resolved = true;
						reject(err);
					}
				});
		});
	}

	// Transport mix path: sign locally, get hex, then submit via author_submitExtrinsic over onion
	const signed = await extrinsic.signAsync(signer);
	const txHex = signed.toHex();

	const result = await sendRpcOverTransportMix({
		entryNodeUrl: cfg.entryNodeUrl,
		rpcUrl: cfg.rpcUrl,
		method: "author_submitExtrinsic",
		params: [txHex],
		transportNodes: cfg.nodes,
		senderSecretKeyHex: cfg.senderSecretKeyHex,
	});

	// result should be the tx hash as a hex string
	if (typeof result === "string") {
		return result;
	}

	// If the RPC returns { result: "0x..." } style, handle that too
	if (result && typeof (result as any).result === "string") {
		return (result as any).result;
	}

	throw new Error(
		`Unexpected author_submitExtrinsic response over transport: ${JSON.stringify(result)}`,
	);
}

export async function connectDaoChain(): Promise<DaoChainClients> {
	const endpoint = process.env.DAOCHAIN_WS_URL || DEFAULT_WS;
	const adminSeed = process.env.DAOCHAIN_ADMIN_SEED;
	const tallySeed = process.env.DAOCHAIN_TALLY_SEED;

	if (!adminSeed) {
		throw new Error("DAOCHAIN_ADMIN_SEED is not set");
	}
	if (!tallySeed) {
		throw new Error("DAOCHAIN_TALLY_SEED is not set");
	}

	const provider = new WsProvider(endpoint);
	const api = await ApiPromise.create({ provider });

	const keyring = new Keyring({ type: "sr25519" });
	const admin = keyring.addFromUri(adminSeed);
	const tally = keyring.addFromUri(tallySeed);

	// Simple real logging (not a demo script, just useful info for the orchestrator/CLI)
	const [chain, nodeName, nodeVersion] = await Promise.all([
		api.rpc.system.chain(),
		api.rpc.system.name(),
		api.rpc.system.version(),
	]);

	console.log(`🔗 DaoChain connected at ${endpoint}`);
	console.log(
		`📦 Chain: ${chain.toString()} | Node: ${nodeName.toString()} v${nodeVersion.toString()}`,
	);

	return { api, admin, tally };
}

/**
 * Create a new election on DaoChain.
 */
export async function createElectionTx(
	clients: DaoChainClients,
	electionId: number,
	registrationDeadline: number,
	votingDeadline: number,
	transportConfig?: TransportConfig,
): Promise<string> {
	const { api, admin, tally } = clients;

	const tx = api.tx.daomixVoting.createElection(
		electionId,
		tally.address, // tally_authority
		registrationDeadline,
		votingDeadline,
	);

	const hash = await submitExtrinsic(api, admin, tx, transportConfig);
	console.log(`✅ createElection submitted, hash: ${hash}`);
	return hash;
}

/**
 * Register a voter for an election.
 */
export async function registerVoterTx(
	clients: DaoChainClients,
	electionId: number,
	voterAddress: string,
	transportConfig?: TransportConfig,
): Promise<string> {
	const { api, admin } = clients;

	const tx = api.tx.daomixVoting.registerVoter(electionId, voterAddress);
	const hash = await submitExtrinsic(api, admin, tx, transportConfig);
	console.log(`✅ registerVoter submitted, hash: ${hash}`);
	return hash;
}

/**
 * Cast an encrypted ballot.
 */
export async function castVoteTx(
	api: ApiPromise,
	voterSuri: string,
	electionId: number,
	ciphertext: Uint8Array,
	transportConfig?: TransportConfig,
): Promise<string> {
	const keyring = new Keyring({ type: "sr25519" });
	const voter = keyring.addFromUri(voterSuri);

	const tx = api.tx.daomixVoting.castVote(electionId, ciphertext);

	const hash = await submitExtrinsic(api, voter, tx, transportConfig);
	console.log(`✅ castVote submitted by ${voter.address}, hash: ${hash}`);
	return hash;
}

/**
 * Set mix commitments (input and output Merkle roots) for an election.
 */
export async function setMixCommitmentsTx(
	clients: DaoChainClients,
	electionId: number,
	inputRoot: Uint8Array,
	outputRoot: Uint8Array,
	transportConfig?: TransportConfig,
): Promise<string> {
	const { api, tally } = clients;

	const tx = api.tx.daomixVoting.setMixCommitments(
		electionId,
		inputRoot,
		outputRoot,
	);

	const hash = await submitExtrinsic(api, tally, tx, transportConfig);
	console.log(`✅ setMixCommitments submitted, hash: ${hash}`);
	return hash;
}

/**
 * Submit final tally results for an election.
 */
export async function submitTallyTx(
	clients: DaoChainClients,
	electionId: number,
	resultUri: Uint8Array,
	resultHash: Uint8Array,
	transportConfig?: TransportConfig,
): Promise<string> {
	const { api, tally } = clients;

	const tx = api.tx.daomixVoting.submitTally(electionId, resultUri, resultHash);

	const hash = await submitExtrinsic(api, tally, tx, transportConfig);
	console.log(`✅ submitTally submitted, hash: ${hash}`);
	return hash;
}

