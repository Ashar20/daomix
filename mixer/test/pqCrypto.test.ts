import { describe, it, expect, beforeAll } from "vitest";
import {
  initPq,
  generatePqKeypair,
  pqEncapsulate,
  pqDecapsulate,
  combineSharedSecrets,
  PqKeypair,
} from "../src/crypto/pqCrypto";
import { initCrypto } from "../src/crypto/crypto";

describe("Post-Quantum Cryptography (ML-KEM-768)", () => {
  beforeAll(async () => {
    // Initialize both classical and PQ crypto
    await initCrypto();
    await initPq();
  });

  describe("initPq", () => {
    it("initializes without throwing", async () => {
      // Already initialized in beforeAll, but test explicit initialization
      await expect(initPq()).resolves.not.toThrow();
    });
  });

  describe("generatePqKeypair", () => {
    it("returns keys of expected size", async () => {
      const keypair = await generatePqKeypair();

      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.secretKey).toBeInstanceOf(Uint8Array);

      // ML-KEM-768 public key size: 1184 bytes
      expect(keypair.publicKey.length).toBe(1184);
      // ML-KEM-768 secret key size: 2400 bytes
      expect(keypair.secretKey.length).toBe(2400);
    });

    it("generates different keypairs on each call", async () => {
      const keypair1 = await generatePqKeypair();
      const keypair2 = await generatePqKeypair();

      // Public keys should be different
      expect(keypair1.publicKey).not.toEqual(keypair2.publicKey);
      // Secret keys should be different
      expect(keypair1.secretKey).not.toEqual(keypair2.secretKey);
    });
  });

  describe("pqEncapsulate and pqDecapsulate", () => {
    it("produces identical shared secrets for matching keypair", async () => {
      const recipient = await generatePqKeypair();

      // Sender encapsulates
      const encapsulated = await pqEncapsulate(recipient.publicKey);

      // Verify ciphertext and shared secret sizes
      // ML-KEM-768 ciphertext size: 1088 bytes
      expect(encapsulated.ciphertext.length).toBe(1088);
      // ML-KEM-768 shared secret size: 32 bytes
      expect(encapsulated.sharedSecret.length).toBe(32);

      // Recipient decapsulates
      const decapsulated = await pqDecapsulate(
        encapsulated.ciphertext,
        recipient.secretKey,
      );

      // Shared secrets must match
      expect(decapsulated.length).toBe(32);
      expect(decapsulated).toEqual(encapsulated.sharedSecret);
    });

    it("produces different shared secrets for different recipients", async () => {
      const recipient1 = await generatePqKeypair();
      const recipient2 = await generatePqKeypair();

      const encapsulated1 = await pqEncapsulate(recipient1.publicKey);
      const encapsulated2 = await pqEncapsulate(recipient2.publicKey);

      // Different recipients should produce different shared secrets
      expect(encapsulated1.sharedSecret).not.toEqual(encapsulated2.sharedSecret);
    });

    it("produces different shared secret with wrong secret key", async () => {
      const recipient = await generatePqKeypair();
      const wrongRecipient = await generatePqKeypair();

      const encapsulated = await pqEncapsulate(recipient.publicKey);

      // Decapsulation with wrong secret key succeeds (ML-KEM property)
      // but produces a different (indeterminate) shared secret
      const wrongDecapsulated = await pqDecapsulate(
        encapsulated.ciphertext,
        wrongRecipient.secretKey,
      );

      // The shared secret should be different from the original
      expect(wrongDecapsulated).not.toEqual(encapsulated.sharedSecret);

      // Verify the correct secret key produces the correct shared secret
      const correctDecapsulated = await pqDecapsulate(
        encapsulated.ciphertext,
        recipient.secretKey,
      );
      expect(correctDecapsulated).toEqual(encapsulated.sharedSecret);
    });

    it("round-trip: multiple encapsulations produce valid shared secrets", async () => {
      const recipient = await generatePqKeypair();

      // Perform multiple encapsulations
      const results = await Promise.all([
        pqEncapsulate(recipient.publicKey),
        pqEncapsulate(recipient.publicKey),
        pqEncapsulate(recipient.publicKey),
      ]);

      // Each should produce a valid shared secret
      for (const encapsulated of results) {
        const decapsulated = await pqDecapsulate(
          encapsulated.ciphertext,
          recipient.secretKey,
        );
        expect(decapsulated).toEqual(encapsulated.sharedSecret);
      }

      // Different encapsulations should produce different shared secrets
      // (unless RNG is broken, which is extremely unlikely)
      expect(results[0].sharedSecret).not.toEqual(results[1].sharedSecret);
      expect(results[1].sharedSecret).not.toEqual(results[2].sharedSecret);
      expect(results[0].sharedSecret).not.toEqual(results[2].sharedSecret);
    });
  });

  describe("combineSharedSecrets", () => {
    it("produces the same output for the same inputs", () => {
      const classical = new Uint8Array(32);
      const postQuantum = new Uint8Array(32);
      // Fill with test data
      for (let i = 0; i < 32; i++) {
        classical[i] = i;
        postQuantum[i] = i * 2;
      }

      const combined1 = combineSharedSecrets(classical, postQuantum);
      const combined2 = combineSharedSecrets(classical, postQuantum);

      expect(combined1).toEqual(combined2);
      expect(combined1.length).toBe(32);
    });

    it("produces different output if classical secret is changed", () => {
      const classical1 = new Uint8Array(32);
      const classical2 = new Uint8Array(32);
      const postQuantum = new Uint8Array(32);

      // Fill with test data
      for (let i = 0; i < 32; i++) {
        classical1[i] = i;
        classical2[i] = i + 1; // Different value
        postQuantum[i] = i * 2;
      }

      const combined1 = combineSharedSecrets(classical1, postQuantum);
      const combined2 = combineSharedSecrets(classical2, postQuantum);

      expect(combined1).not.toEqual(combined2);
    });

    it("produces different output if post-quantum secret is changed", () => {
      const classical = new Uint8Array(32);
      const postQuantum1 = new Uint8Array(32);
      const postQuantum2 = new Uint8Array(32);

      // Fill with test data
      for (let i = 0; i < 32; i++) {
        classical[i] = i;
        postQuantum1[i] = i * 2;
        postQuantum2[i] = i * 2 + 1; // Different value
      }

      const combined1 = combineSharedSecrets(classical, postQuantum1);
      const combined2 = combineSharedSecrets(classical, postQuantum2);

      expect(combined1).not.toEqual(combined2);
    });

    it("produces uniform 32-byte output", () => {
      const classical = new Uint8Array(32);
      const postQuantum = new Uint8Array(32);

      // Fill with random-looking test data
      for (let i = 0; i < 32; i++) {
        classical[i] = (i * 7) % 256;
        postQuantum[i] = (i * 11) % 256;
      }

      const combined = combineSharedSecrets(classical, postQuantum);

      expect(combined.length).toBe(32);
      // Should produce non-zero output
      const hasNonZero = combined.some((byte) => byte !== 0);
      expect(hasNonZero).toBe(true);
    });

    it("combines real PQ shared secrets correctly", async () => {
      // Generate real ML-KEM keypair and shared secret
      const recipient = await generatePqKeypair();
      const encapsulated = await pqEncapsulate(recipient.publicKey);
      const decapsulated = await pqDecapsulate(
        encapsulated.ciphertext,
        recipient.secretKey,
      );

      // Verify shared secrets match
      expect(decapsulated).toEqual(encapsulated.sharedSecret);

      // Generate a dummy classical shared secret (32 bytes)
      const classical = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        classical[i] = i;
      }

      // Combine them
      const combined = combineSharedSecrets(classical, encapsulated.sharedSecret);

      expect(combined.length).toBe(32);
      // Combined should be different from either input
      expect(combined).not.toEqual(classical);
      expect(combined).not.toEqual(encapsulated.sharedSecret);
    });
  });
});

