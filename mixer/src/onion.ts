import {
	Keypair,
	HexString,
	fromHex,
	toHex,
	initCrypto,
	deriveHybridAeadKey,
	deriveHybridAeadKeyForReceiver,
} from "./crypto";
import sodium from "libsodium-wrappers";

export interface NodePublic {
	publicKey: Uint8Array;
	pqPublicKey?: Uint8Array; // Optional ML-KEM public key
}

export interface OnionBuildParams {
  vote: Uint8Array;
  mixNodes: NodePublic[];
  tally: NodePublic;
  senderKeypair: Keypair;
}

/**
 * Pack PQ ciphertext and regular ciphertext into a single hex string.
 * Format: [PQ_CIPHERTEXT_LEN (2 bytes)] [PQ_CIPHERTEXT (if len > 0)] [NONCE || CIPHERTEXT]
 */
function packHybridCiphertext(
	pqCiphertext: Uint8Array | undefined,
	regularCiphertext: Uint8Array,
): Uint8Array {
	if (!pqCiphertext || pqCiphertext.length === 0) {
		// No PQ: return regular ciphertext as-is (backward compatible)
		return regularCiphertext;
	}

	// PQ enabled: prepend PQ ciphertext length (2 bytes, big-endian) + PQ ciphertext
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
 * Returns { pqCiphertext, regularCiphertext }.
 */
function unpackHybridCiphertext(
	data: Uint8Array,
): { pqCiphertext?: Uint8Array; regularCiphertext: Uint8Array } {
	if (data.length < 2) {
		// Too short to have PQ prefix, treat as classical-only
		return { regularCiphertext: data };
	}

	const pqLen = (data[0] << 8) | data[1];

	if (pqLen === 0 || data.length < 2 + pqLen) {
		// No PQ or invalid length, treat as classical-only
		return { regularCiphertext: data };
	}

	const pqCiphertext = data.slice(2, 2 + pqLen);
	const regularCiphertext = data.slice(2 + pqLen);

	return { pqCiphertext, regularCiphertext };
}

/**
 * Encrypt a layer using hybrid key derivation (if PQ enabled).
 */
async function encryptLayerHybrid(
	recipientPublicKey: Uint8Array,
	senderSecretKey: Uint8Array,
	inner: Uint8Array,
	recipientPqPublicKey?: Uint8Array,
): Promise<HexString> {
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

	const combined = packHybridCiphertext(
		hybridResult.pqCiphertext,
		regularCiphertext,
	);

	return toHex(combined);
}

export async function buildOnion(
	params: OnionBuildParams,
): Promise<HexString> {
	await initCrypto();

	// Build from innermost (tally) to outermost (first mix node)
	let currentHex = await encryptLayerHybrid(
		params.tally.publicKey,
		params.senderKeypair.secretKey,
		params.vote,
		params.tally.pqPublicKey,
	);

	for (let i = params.mixNodes.length - 1; i >= 0; i--) {
		const asBytes = fromHex(currentHex);
		currentHex = await encryptLayerHybrid(
			params.mixNodes[i].publicKey,
			params.senderKeypair.secretKey,
			asBytes,
			params.mixNodes[i].pqPublicKey,
		);
	}

	return currentHex;
}

/**
 * Decrypt a layer using hybrid key derivation (if PQ enabled).
 */
async function decryptLayerHybrid(
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
		throw new Error("DaoMix: ciphertext too short");
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
		throw new Error("DaoMix: failed to decrypt layer");
	}
}

export async function peelOnionForNode(
	layersHex: HexString,
	nodeKeypair: Keypair,
	senderPublicKey: Uint8Array,
	nodePqSecretKey?: Uint8Array,
): Promise<HexString> {
	await initCrypto();

	const inner = await decryptLayerHybrid(
		nodeKeypair.secretKey,
		senderPublicKey,
		layersHex,
		nodePqSecretKey,
	);

	return toHex(inner);
}

export async function decryptFinalForTally(
	finalHex: HexString,
	tallyKeypair: Keypair,
	senderPublicKey: Uint8Array,
	tallyPqSecretKey?: Uint8Array,
): Promise<Uint8Array> {
	await initCrypto();

	return decryptLayerHybrid(
		tallyKeypair.secretKey,
		senderPublicKey,
		finalHex,
		tallyPqSecretKey,
	);
}

