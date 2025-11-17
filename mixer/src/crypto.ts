import sodium from "libsodium-wrappers";
import {
	initPq,
	pqEncapsulate,
	pqDecapsulate,
	combineSharedSecrets,
} from "./pqCrypto";
import { isPqEnabled } from "./config";

export interface Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export type HexString = `0x${string}`;

let sodiumReady = false;

export async function initCrypto(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

export function generateKeypair(): Keypair {
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: new Uint8Array(kp.publicKey),
    secretKey: new Uint8Array(kp.privateKey),
  };
}

export function toHex(bytes: Uint8Array): HexString {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function fromHex(hex: HexString): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(normalized, "hex"));
}

export async function publicKeyFromSecret(
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  await initCrypto();
  return sodium.crypto_scalarmult_base(secretKey);
}

function deriveKey(shared: Uint8Array): Uint8Array {
  const context = sodium.from_string("DaoMix-layer");
  return sodium.crypto_generichash(32, shared, context);
}

/**
 * Derive X25519 shared secret (internal helper).
 */
function deriveX25519SharedSecret(
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
): Uint8Array {
  return sodium.crypto_scalarmult(senderSecretKey, recipientPublicKey);
}

/**
 * Derive AEAD key from classical-only shared secret.
 */
function kdfFromClassicalOnly(classicalSecret: Uint8Array): Uint8Array {
  const context = sodium.from_string("DaoMix-layer");
  return sodium.crypto_generichash(32, classicalSecret, context);
}

/**
 * Derive AEAD key from hybrid (combined) shared secret.
 */
function kdfFromHybrid(combinedSecret: Uint8Array): Uint8Array {
  const context = sodium.from_string("DaoMix-hybrid-layer");
  return sodium.crypto_generichash(32, combinedSecret, context);
}

/**
 * Hybrid key derivation inputs.
 */
export interface HybridKeyInputs {
  senderSecretKey: Uint8Array; // X25519 sender SK
  recipientPublicKey: Uint8Array; // X25519 recipient PK
  recipientPqPublicKey?: Uint8Array; // optional ML-KEM PK
}

/**
 * Hybrid key derivation result.
 */
export interface HybridKeyResult {
  symmetricKey: Uint8Array; // final AEAD key (32 bytes)
  pqCiphertext?: Uint8Array; // if PQ used, ML-KEM ciphertext to send along (1088 bytes)
}

/**
 * Derive hybrid AEAD key for encryption (sender side).
 *
 * If PQ is enabled and recipient has a PQ public key, this performs:
 * 1. Classical X25519 ECDH → classical shared secret
 * 2. ML-KEM encapsulation → PQ shared secret
 * 3. Combine both secrets via KDF → combined shared secret
 * 4. Derive AEAD key from combined secret
 *
 * If PQ is disabled or recipient has no PQ key, falls back to classical-only.
 *
 * @param inputs - Key derivation inputs
 * @returns Hybrid key result with symmetric key and optional PQ ciphertext
 */
export async function deriveHybridAeadKey(
  inputs: HybridKeyInputs,
): Promise<HybridKeyResult> {
  // 1) Classical X25519 shared secret
  const classicalSecret = deriveX25519SharedSecret(
    inputs.senderSecretKey,
    inputs.recipientPublicKey,
  );

  // 2) If no PQ pubkey or PQ disabled, just derive from classical
  if (!isPqEnabled() || !inputs.recipientPqPublicKey) {
    const symmetricKey = kdfFromClassicalOnly(classicalSecret);
    return { symmetricKey };
  }

  // 3) PQ: KEM encapsulate to recipient PQ public key
  await initPq();
  const { ciphertext: pqCt, sharedSecret: pqSecret } =
    await pqEncapsulate(inputs.recipientPqPublicKey);

  // 4) Combine classical and PQ shared secrets
  const combined = combineSharedSecrets(classicalSecret, pqSecret);

  // 5) Derive AEAD key from combined secret
  const symmetricKey = kdfFromHybrid(combined);

  return { symmetricKey, pqCiphertext: pqCt };
}

/**
 * Derive hybrid AEAD key for decryption (receiver side).
 *
 * If PQ is enabled and PQ ciphertext is present, this performs:
 * 1. Classical X25519 ECDH → classical shared secret
 * 2. ML-KEM decapsulation → PQ shared secret
 * 3. Combine both secrets via KDF → combined shared secret
 * 4. Derive AEAD key from combined secret
 *
 * If PQ is disabled or PQ ciphertext is missing, falls back to classical-only.
 *
 * @param nodeSecretKey - X25519 secret key of the receiver
 * @param senderPublicKey - X25519 public key of the sender
 * @param pqCiphertext - Optional ML-KEM ciphertext (1088 bytes)
 * @param nodePqSecretKey - Optional ML-KEM secret key of the receiver (2400 bytes)
 * @returns Symmetric AEAD key (32 bytes)
 */
export async function deriveHybridAeadKeyForReceiver(
  nodeSecretKey: Uint8Array,
  senderPublicKey: Uint8Array,
  pqCiphertext?: Uint8Array,
  nodePqSecretKey?: Uint8Array,
): Promise<Uint8Array> {
  // 1) Classical X25519 shared secret
  const classicalSecret = deriveX25519SharedSecret(
    nodeSecretKey,
    senderPublicKey,
  );

  // 2) If no PQ ciphertext or PQ disabled, just derive from classical
  if (!isPqEnabled() || !pqCiphertext || !nodePqSecretKey) {
    return kdfFromClassicalOnly(classicalSecret);
  }

  // 3) PQ: KEM decapsulate
  await initPq();
  const pqSecret = await pqDecapsulate(pqCiphertext, nodePqSecretKey);

  // 4) Combine classical and PQ shared secrets
  const combined = combineSharedSecrets(classicalSecret, pqSecret);

  // 5) Derive AEAD key from combined secret
  return kdfFromHybrid(combined);
}

export function encryptLayer(
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array,
  inner: Uint8Array,
): HexString {
  const shared = sodium.crypto_scalarmult(senderSecretKey, recipientPublicKey);
  const key = deriveKey(shared);

  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    inner,
    null,
    null,
    nonce,
    key,
  );

  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return toHex(combined);
}

export function decryptLayer(
  recipientSecretKey: Uint8Array,
  senderPublicKey: Uint8Array,
  outerHex: HexString,
): Uint8Array {
  const outer = fromHex(outerHex);
  const nonceBytes =
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;

  if (outer.length < nonceBytes) {
    throw new Error("DaoMix: ciphertext too short");
  }

  const nonce = outer.slice(0, nonceBytes);
  const ciphertext = outer.slice(nonceBytes);

  const shared = sodium.crypto_scalarmult(recipientSecretKey, senderPublicKey);
  const key = deriveKey(shared);

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      key,
    );
  } catch (err) {
    throw new Error("DaoMix: failed to decrypt layer");
  }
}

