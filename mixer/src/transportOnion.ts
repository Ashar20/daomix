import {
	initCrypto,
	encryptLayer,
	decryptLayer,
	toHex,
	fromHex,
	type HexString,
} from "./crypto";
import { TextEncoder, TextDecoder } from "util";

export interface TransportNodePub {
	id: string; // logical name, e.g., "entry", "middle1", "exit"
	publicKey: HexString; // hex-encoded libsodium public key
}

/**
 * Encode RPC payload and URL into a Uint8Array.
 */
export function encodeRpcPayload(
	rpcBody: unknown,
	rpcUrl: string,
): Uint8Array {
	const payload = {
		rpcUrl,
		body: rpcBody,
	};
	const jsonStr = JSON.stringify(payload);
	return new TextEncoder().encode(jsonStr);
}

/**
 * Decode RPC payload from a Uint8Array.
 */
export function decodeRpcPayload(bytes: Uint8Array): {
	rpcUrl: string;
	body: unknown;
} {
	const jsonStr = new TextDecoder().decode(bytes);
	const payload = JSON.parse(jsonStr);

	if (!payload || typeof payload !== "object") {
		throw new Error("Invalid RPC payload: expected object");
	}

	if (typeof payload.rpcUrl !== "string" || payload.rpcUrl.length === 0) {
		throw new Error("Invalid RPC payload: rpcUrl must be non-empty string");
	}

	// Allow any object or array for body, don't over-validate
	if (payload.body !== null && typeof payload.body !== "object") {
		throw new Error("Invalid RPC payload: body must be object or array");
	}

	return {
		rpcUrl: payload.rpcUrl,
		body: payload.body,
	};
}

/**
 * Build a transport onion for JSON-RPC traffic.
 *
 * @param params - Parameters for building the onion
 * @returns Hex-encoded outermost ciphertext
 */
export async function buildTransportOnion(params: {
	rpcBody: unknown;
	rpcUrl: string;
	nodes: TransportNodePub[];
	senderSecretKey: Uint8Array;
	senderPublicKey: Uint8Array;
}): Promise<HexString> {
	await initCrypto();

	// Encode the innermost payload
	const innerBytes = encodeRpcPayload(params.rpcBody, params.rpcUrl);

	// Build onion layers in reverse order (exit → ... → entry)
	let currentBytes = innerBytes;

	for (let i = params.nodes.length - 1; i >= 0; i--) {
		const node = params.nodes[i];
		const nodePublicKey = fromHex(node.publicKey);
		currentBytes = fromHex(
			encryptLayer(
				nodePublicKey,
				params.senderSecretKey,
				currentBytes,
			),
		);
	}

	return toHex(currentBytes);
}

/**
 * Peel one layer from a transport onion.
 *
 * @param params - Parameters for peeling the layer
 * @returns Inner payload as Uint8Array (may still be ciphertext for next hop)
 */
export async function peelTransportLayer(params: {
	ciphertext: HexString;
	nodeSecretKey: Uint8Array;
	senderPublicKey: Uint8Array;
}): Promise<Uint8Array> {
	await initCrypto();

	return decryptLayer(
		params.nodeSecretKey,
		params.senderPublicKey,
		params.ciphertext,
	);
}

