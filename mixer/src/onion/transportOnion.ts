import {
	initCrypto,
	toHex,
	fromHex,
	type HexString,
	deriveHybridAeadKey,
	deriveHybridAeadKeyForReceiver,
} from "../crypto/crypto";
import sodium from "libsodium-wrappers";
import { TextEncoder, TextDecoder } from "util";

export interface TransportNodePub {
	id: string; // logical name, e.g., "entry", "middle1", "exit"
	publicKey: HexString; // hex-encoded libsodium public key
	pqPublicKey?: HexString; // optional hex-encoded ML-KEM public key
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
 * Pack PQ ciphertext and regular ciphertext into a single hex string.
 * Format: [PQ_CIPHERTEXT_LEN (2 bytes)] [PQ_CIPHERTEXT (if len > 0)] [NONCE || CIPHERTEXT]
 */
function packHybridCiphertext(
	pqCiphertext: Uint8Array | undefined,
	regularCiphertext: Uint8Array,
): Uint8Array {
	if (!pqCiphertext) {
		return regularCiphertext;
	}

	const lenBuffer = new Uint8Array(2);
	lenBuffer[0] = (pqCiphertext.length >> 8) & 0xff;
	lenBuffer[1] = pqCiphertext.length & 0xff;

	const combined = new Uint8Array(
		2 + pqCiphertext.length + regularCiphertext.length,
	);
	let offset = 0;
	combined.set(lenBuffer, offset);
	offset += 2;
	combined.set(pqCiphertext, offset);
	offset += pqCiphertext.length;
	combined.set(regularCiphertext, offset);

	return combined;
}

/**
 * Unpack PQ ciphertext and regular ciphertext from a hex string.
 */
function unpackHybridCiphertext(
	data: Uint8Array,
): { pqCiphertext?: Uint8Array; regularCiphertext: Uint8Array } {
	if (data.length < 2) {
		return { regularCiphertext: data };
	}

	const pqLen = (data[0] << 8) | data[1];

	if (pqLen === 0 || data.length < 2 + pqLen) {
		return { regularCiphertext: data };
	}

	const pqCiphertext = data.slice(2, 2 + pqLen);
	const regularCiphertext = data.slice(2 + pqLen);

	return { pqCiphertext, regularCiphertext };
}

/**
 * Encrypt a transport layer using hybrid key derivation (if PQ enabled).
 */
async function encryptTransportLayerHybrid(
	recipientPublicKey: Uint8Array,
	senderSecretKey: Uint8Array,
	inner: Uint8Array,
	recipientPqPublicKey?: Uint8Array,
): Promise<Uint8Array> {
	const hybridResult = await deriveHybridAeadKey({
		senderSecretKey,
		recipientPublicKey,
		recipientPqPublicKey,
	});

	const symmetricKey = hybridResult.symmetricKey;
	const nonce = sodium.randombytes_buf(
		sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
	);

	const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
		inner,
		null,
		null,
		nonce,
		symmetricKey,
	);

	const regularCiphertext = new Uint8Array(nonce.length + ciphertext.length);
	regularCiphertext.set(nonce, 0);
	regularCiphertext.set(ciphertext, nonce.length);

	return packHybridCiphertext(hybridResult.pqCiphertext, regularCiphertext);
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
		const nodePqPublicKey = node.pqPublicKey
			? fromHex(node.pqPublicKey)
			: undefined;

		currentBytes = await encryptTransportLayerHybrid(
			nodePublicKey,
			params.senderSecretKey,
			currentBytes,
			nodePqPublicKey,
		);
	}

	return toHex(currentBytes);
}

/**
 * Decrypt a transport layer using hybrid key derivation (if PQ enabled).
 */
async function decryptTransportLayerHybrid(
	nodeSecretKey: Uint8Array,
	senderPublicKey: Uint8Array,
	outerHex: HexString,
	nodePqSecretKey?: Uint8Array,
): Promise<Uint8Array> {
	const outer = fromHex(outerHex);
	const { pqCiphertext, regularCiphertext } =
		unpackHybridCiphertext(outer);

	const symmetricKey = await deriveHybridAeadKeyForReceiver(
		nodeSecretKey,
		senderPublicKey,
		pqCiphertext,
		nodePqSecretKey,
	);

	const nonceBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;

	if (regularCiphertext.length < nonceBytes) {
		throw new Error("Transport: ciphertext too short");
	}

	const nonce = regularCiphertext.slice(0, nonceBytes);
	const ciphertext = regularCiphertext.slice(nonceBytes);

	try {
		return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
			null,
			ciphertext,
			null,
			nonce,
			symmetricKey,
		);
	} catch (err) {
		throw new Error("Transport: failed to decrypt layer");
	}
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
	nodePqSecretKey?: Uint8Array;
}): Promise<Uint8Array> {
	await initCrypto();

	return decryptTransportLayerHybrid(
		params.nodeSecretKey,
		params.senderPublicKey,
		params.ciphertext,
		params.nodePqSecretKey,
	);
}

