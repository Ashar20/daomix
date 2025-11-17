import axios from "axios";
import {
	generateKeypair,
	toHex,
	fromHex,
	type HexString,
} from "./crypto";
import {
	buildTransportOnion,
	type TransportNodePub,
} from "./transportOnion";

export interface TransportNode {
	url: string;
	publicKey: HexString;
	pqPublicKey?: Uint8Array; // Optional ML-KEM public key
}

export interface TransportClientConfig {
	entryUrl: string; // e.g. http://localhost:9100
	transportNodes: TransportNodePub[]; // in hop order: [entry, middle?, exit]
	senderSecretKey?: Uint8Array; // optional fixed sender key
	senderPublicKey?: Uint8Array; // optional fixed sender key
}

/**
 * Send a JSON-RPC request over the transport mix network.
 *
 * @param params - Parameters for sending RPC over transport mix
 * @returns JSON-RPC response (result or error)
 */
export async function sendRpcOverTransportMix(params: {
	entryNodeUrl: string;
	rpcUrl: string;
	method: string;
	params: unknown[];
	id?: unknown; // optional request ID from original RPC request
	transportNodes: TransportNode[];
	senderSecretKeyHex?: string; // optional hex secret key, generate if missing
}): Promise<unknown> {
	// 1. Ensure we have a sender keypair: use provided or generate
	let senderSecretKey: Uint8Array;
	let senderPublicKey: Uint8Array;

	if (params.senderSecretKeyHex) {
		senderSecretKey = fromHex(params.senderSecretKeyHex as HexString);
		// Derive public key from secret
		const { publicKeyFromSecret } = await import("./crypto");
		const { initCrypto } = await import("./crypto");
		await initCrypto();
		senderPublicKey = await publicKeyFromSecret(senderSecretKey);
	} else {
		const keypair = generateKeypair();
		senderSecretKey = keypair.secretKey;
		senderPublicKey = keypair.publicKey;
	}

	// 2. Build JSON-RPC request body
	const rpcBody = {
		jsonrpc: "2.0" as const,
		id: params.id !== undefined ? params.id : Date.now(), // use provided ID or generate
		method: params.method,
		params: params.params,
	};

	// 3. Convert TransportNode[] to TransportNodePub[] for buildTransportOnion
	const transportNodePubs: TransportNodePub[] = params.transportNodes.map(
		(node, idx) => ({
			id: `node_${idx}`,
			publicKey: node.publicKey,
			pqPublicKey: node.pqPublicKey ? toHex(node.pqPublicKey) : undefined,
		}),
	);

	// 4. Build the onion
	const ciphertext = await buildTransportOnion({
		rpcBody,
		rpcUrl: params.rpcUrl,
		nodes: transportNodePubs,
		senderSecretKey,
		senderPublicKey,
	});

	// 5. POST to entry node
	const entryEndpoint = params.entryNodeUrl.endsWith("/rpc-mix")
		? params.entryNodeUrl
		: `${params.entryNodeUrl}/rpc-mix`;

	const response = await axios.post(
		entryEndpoint,
		{
			ciphertext,
			senderPublicKey: toHex(senderPublicKey),
		},
		{
			timeout: 60_000,
		},
	);

	// 6. Return response.data (JSON-RPC result)
	return response.data;
}

