import "dotenv/config";
import { ApiPromise, WsProvider } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { Keyring } from "@polkadot/keyring";
import type { KeyringPair } from "@polkadot/keyring/types";
import { hexToU8a } from "@polkadot/util";
import {
	sendRpcOverTransportMix,
	type TransportNode,
} from "./transportClient";
import { toHex } from "./crypto";

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
			const txHash = extrinsic.hash;
			extrinsic
				.signAndSend(signer, (result) => {
					const { status, dispatchError } = result as any;
					if (!resolved) {
						if (status?.isReady) {
							console.log("[DaoChain] tx status: Ready");
						} else if (status?.isBroadcast) {
							console.log("[DaoChain] tx status: Broadcast");
						} else if (status?.isInBlock) {
							(async () => {
								const blockHash = status.asInBlock;
								console.log("[DaoChain] tx included in block:", blockHash?.toString?.());
								// Decode events for this block (log any failures; we don't try to map index precisely)
								try {
									const allEvents = await api.query.system.events.at(blockHash);
									const eventsList = (allEvents as unknown as any[]) || [];
									for (const rec of eventsList) {
										const event = rec.event;
										const phase = rec.phase;
										if (phase.isApplyExtrinsic && event.section === "system" && event.method === "ExtrinsicFailed") {
											// Decode module error if present
											const dispatchErrorInner = (event as unknown as { data: any[] }).data?.[0];
											if (dispatchErrorInner?.isModule) {
												const mod = dispatchErrorInner.asModule;
												const meta = api.registry.findMetaError({ index: mod.index, error: mod.error });
												const docs = (meta as any).docs ?? (meta as any).documentation ?? [];
												const docStr = Array.isArray(docs) ? docs.join(" ") : String(docs);
												console.error("[DaoChain] ExtrinsicFailed:", `${(meta as any).section}.${(meta as any).name}`, docStr);
											} else {
												console.error("[DaoChain] ExtrinsicFailed (non-module):", dispatchErrorInner?.toString?.() ?? String(dispatchErrorInner));
											}
											console.error("[DaoChain] Failed extrinsic hash (maybe):", txHash.toHex(), "method:", extrinsic.method?.toHuman?.());
										} else if (phase.isApplyExtrinsic && event.section === "system" && event.method === "ExtrinsicSuccess") {
											console.log("[DaoChain] ExtrinsicSuccess (some tx in block):", txHash.toHex());
										}
									}
								} catch (e) {
									console.warn("[DaoChain] Failed to decode events:", (e as Error).message);
								}
								if (!resolved) {
									resolved = true;
									resolve(blockHash.toHex());
								}
							})().catch((e) => {
								console.warn("[DaoChain] Event processing error:", (e as Error).message);
								if (!resolved) {
									resolved = true;
									resolve(status.asInBlock.toHex());
								}
							});
							return;
						} else if (status?.isFinalized) {
							(async () => {
								const blockHash = status.asFinalized;
								console.log("[DaoChain] tx finalized at:", blockHash?.toString?.());
								// Check for extrinsic failures in the finalized block
								try {
									const allEvents = await api.query.system.events.at(blockHash);
									const eventsList = (allEvents as unknown as any[]) || [];
									for (const rec of eventsList) {
										const event = rec.event;
										const phase = rec.phase;
										if (phase.isApplyExtrinsic && event.section === "system" && event.method === "ExtrinsicFailed") {
											// Decode module error if present
											const dispatchErrorInner = (event as unknown as { data: any[] }).data?.[0];
											if (dispatchErrorInner?.isModule) {
												const mod = dispatchErrorInner.asModule;
												const meta = api.registry.findMetaError({ index: mod.index, error: mod.error });
												const docs = (meta as any).docs ?? (meta as any).documentation ?? [];
												const docStr = Array.isArray(docs) ? docs.join(" ") : String(docs);
												console.error("[DaoChain] ExtrinsicFailed:", `${(meta as any).section}.${(meta as any).name}`, docStr);
											} else {
												console.error("[DaoChain] ExtrinsicFailed (non-module):", dispatchErrorInner?.toString?.() ?? String(dispatchErrorInner));
											}
											console.error("[DaoChain] Failed extrinsic hash (maybe):", txHash.toHex(), "method:", extrinsic.method?.toHuman?.());
										} else if (phase.isApplyExtrinsic && event.section === "system" && event.method === "ExtrinsicSuccess") {
											console.log("[DaoChain] ExtrinsicSuccess:", txHash.toHex());
										}
									}
								} catch (e) {
									console.warn("[DaoChain] Failed to decode events:", (e as Error).message);
								}
								if (!resolved) {
									resolved = true;
									resolve(blockHash.toHex());
								}
							})().catch((e) => {
								console.warn("[DaoChain] Event processing error:", (e as Error).message);
								if (!resolved) {
									resolved = true;
									resolve(status.asFinalized.toHex());
								}
							});
							return;
						}
					}
					if (resolved) {
						return;
					}
					if (dispatchError) {
						// Log but do not reject; allow caller to continue and inspect storage
						console.error("[DaoChain] dispatchError:", dispatchError.toString());
					}
				})
				.catch((err) => {
					if (!resolved) {
						resolved = true;
						// Check if this is a priority/nonce error that we can retry
						const errMsg = String(err?.message || err).toLowerCase();
						if (errMsg.includes("priority is too low") || errMsg.includes("stale")) {
							console.warn("[DaoChain] Transaction pool error (will not retry):", err?.message || err);
						}
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
	signer: KeyringPair,
	electionId: number,
	ciphertextHex: HexString,
	transportConfig?: TransportConfig,
): Promise<string> {
	// Pass as hex (0x...) so the registry treats it as Bytes without mis-sizing
	const tx = api.tx.daomixVoting.castVote(electionId, ciphertextHex);
	const hash = await submitExtrinsic(api, signer, tx, transportConfig);
	console.log(`✅ castVote submitted by ${signer.address}, hash: ${hash}`);
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

	// Convert to hex strings so Polkadot.js handles SCALE encoding correctly
	const resultUriHex = toHex(resultUri);
	const resultHashHex = toHex(resultHash);

	const tx = api.tx.daomixVoting.submitTally(electionId, resultUriHex, resultHashHex);

	const hash = await submitExtrinsic(api, tally, tx, transportConfig);
	console.log(`✅ submitTally submitted, hash: ${hash}`);
	return hash;
}

