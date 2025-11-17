/**
 * Post-Quantum Cryptography Module
 *
 * This module provides a post-quantum KEM (Key Encapsulation Mechanism) using
 * CRYSTALS-Kyber (ML-KEM, NIST FIPS 203) and hybrid key exchange that combines
 * classical (X25519) and post-quantum (Kyber) algorithms.
 *
 * Security Level: ML-KEM-768 provides ~192 bits of classical security and
 * resistance against quantum attacks using Shor's algorithm.
 */

import { MlKem768 } from "crystals-kyber-js";
import sodium from "libsodium-wrappers";

/**
 * Post-quantum keypair (ML-KEM-768)
 *
 * Public key size: 1184 bytes
 * Secret key size: 2400 bytes
 */
export interface PqKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Encapsulated ciphertext and shared secret from ML-KEM
 *
 * Ciphertext size: 1088 bytes (for ML-KEM-768)
 * Shared secret size: 32 bytes
 */
export interface PqEncapsulated {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
}

/**
 * Hybrid shared secret combining classical (X25519) and post-quantum (Kyber) shared secrets.
 *
 * The combined secret is derived using HKDF-SHA256 (or SHA-256) to ensure uniform
 * distribution suitable for use as a symmetric encryption key.
 *
 * Future use: This combined secret will replace the current symmetric key derivation
 * in onion.ts and transportOnion.ts to provide hybrid security.
 */
export interface HybridSharedSecret {
  /** Classical shared secret from X25519 ECDH */
  classical: Uint8Array;
  /** Post-quantum shared secret from ML-KEM */
  postQuantum: Uint8Array;
  /** Combined secret derived via KDF */
  combined: Uint8Array;
}

let pqInitialized = false;
let kyberInstance: MlKem768 | null = null;

/**
 * Initialize post-quantum cryptography.
 *
 * Sets up the ML-KEM instance and ensures libsodium is ready.
 * This should be called before using any PQ functions.
 */
export async function initPq(): Promise<void> {
  if (pqInitialized) {
    return;
  }

  // Ensure libsodium is ready (needed for hybrid key combination)
  await sodium.ready;

  // Create ML-KEM-768 instance
  // ML-KEM-768 provides ~192 bits of classical security (NIST security level 3)
  kyberInstance = new MlKem768();

  pqInitialized = true;
}

/**
 * Generate a post-quantum keypair using ML-KEM-768.
 *
 * @returns A keypair with public key (1184 bytes) and secret key (2400 bytes)
 * @throws Error if initPq() has not been called
 */
export async function generatePqKeypair(): Promise<PqKeypair> {
  if (!pqInitialized || !kyberInstance) {
    throw new Error("pqCrypto: initPq() must be called first");
  }

  const [publicKey, secretKey] = await kyberInstance.generateKeyPair();

  return {
    publicKey: new Uint8Array(publicKey),
    secretKey: new Uint8Array(secretKey),
  };
}

/**
 * Encapsulate a shared secret for a recipient's public key.
 *
 * Performs ML-KEM encapsulation: generates a ciphertext and shared secret
 * that only the holder of the corresponding secret key can decapsulate.
 *
 * @param publicKey The recipient's ML-KEM public key (1184 bytes)
 * @returns Encapsulated ciphertext (1088 bytes) and shared secret (32 bytes)
 * @throws Error if initPq() has not been called or if public key is invalid
 */
export async function pqEncapsulate(
  publicKey: Uint8Array,
): Promise<PqEncapsulated> {
  if (!pqInitialized || !kyberInstance) {
    throw new Error("pqCrypto: initPq() must be called first");
  }

  const [ciphertext, sharedSecret] = await kyberInstance.encap(publicKey);

  return {
    ciphertext: new Uint8Array(ciphertext),
    sharedSecret: new Uint8Array(sharedSecret),
  };
}

/**
 * Decapsulate a shared secret from a ciphertext using the secret key.
 *
 * Recovers the shared secret that was encapsulated by pqEncapsulate().
 *
 * @param ciphertext The encapsulated ciphertext (1088 bytes)
 * @param secretKey The recipient's ML-KEM secret key (2400 bytes)
 * @returns The shared secret (32 bytes)
 * @throws Error if initPq() has not been called or if decapsulation fails
 */
export async function pqDecapsulate(
  ciphertext: Uint8Array,
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  if (!pqInitialized || !kyberInstance) {
    throw new Error("pqCrypto: initPq() must be called first");
  }

  const sharedSecret = await kyberInstance.decap(ciphertext, secretKey);

  return new Uint8Array(sharedSecret);
}

/**
 * Combine classical and post-quantum shared secrets using a KDF.
 *
 * This function uses a key derivation function (KDF) based on Blake2b (via
 * libsodium's crypto_generichash) to combine the two shared secrets into a
 * uniform 32-byte key suitable for use as a symmetric encryption key.
 *
 * The KDF uses a fixed context string "DaoMix-Hybrid-KDF" to ensure domain
 * separation and prevent key reuse across different contexts.
 *
 * Implementation: We concatenate the two secrets with the context, then hash
 * to produce a uniform 32-byte output. This provides strong security properties
 * while being simple and efficient.
 *
 * @param classical The classical shared secret from X25519 (32 bytes)
 * @param postQuantum The post-quantum shared secret from ML-KEM (32 bytes)
 * @returns Combined 32-byte shared secret derived via KDF
 */
export function combineSharedSecrets(
  classical: Uint8Array,
  postQuantum: Uint8Array,
): Uint8Array {
  // Ensure libsodium is ready
  if (!sodiumReady()) {
    throw new Error("pqCrypto: libsodium not ready");
  }

  // Domain separation context
  const context = sodium.from_string("DaoMix-Hybrid-KDF");

  // Concatenate: context || classical || postQuantum
  // This ensures that changing either input produces a different output
  const input = new Uint8Array(context.length + classical.length + postQuantum.length);
  let offset = 0;
  input.set(context, offset);
  offset += context.length;
  input.set(classical, offset);
  offset += classical.length;
  input.set(postQuantum, offset);

  // Derive a uniform 32-byte key using Blake2b (via crypto_generichash)
  // This provides strong mixing and uniform distribution
  const combined = sodium.crypto_generichash(32, input);

  return combined;
}

/**
 * Check if libsodium is ready.
 */
function sodiumReady(): boolean {
  try {
    return sodium.ready !== undefined;
  } catch {
    return false;
  }
}

