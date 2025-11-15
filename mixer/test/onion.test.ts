import { describe, it, expect, beforeAll } from "vitest";
import {
	initCrypto,
	generateKeypair,
} from "../src/crypto";
import {
	buildOnion,
	peelOnionForNode,
	decryptFinalForTally,
} from "../src/onion";
import {
	initPq,
	generatePqKeypair,
} from "../src/pqCrypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("DaoMix onion ballots", () => {
  beforeAll(async () => {
    await initCrypto();
  });

  it("builds and peels a 3-node onion to recover the original vote", async () => {
    const tally = generateKeypair();
    const m1 = generateKeypair();
    const m2 = generateKeypair();
    const m3 = generateKeypair();
    const sender = generateKeypair();

    const voteText = "CANDIDATE_A";
    const voteBytes = encoder.encode(voteText);

    const onion = await buildOnion({
      vote: voteBytes,
      mixNodes: [
        { publicKey: m1.publicKey },
        { publicKey: m2.publicKey },
        { publicKey: m3.publicKey },
      ],
      tally: { publicKey: tally.publicKey },
      senderKeypair: sender,
    });

    const afterM1 = await peelOnionForNode(onion, m1, sender.publicKey);
    const afterM2 = await peelOnionForNode(afterM1, m2, sender.publicKey);
    const afterM3 = await peelOnionForNode(afterM2, m3, sender.publicKey);

    const finalPlain = await decryptFinalForTally(
      afterM3,
      tally,
      sender.publicKey,
    );
    const decoded = decoder.decode(finalPlain);

    expect(decoded).toBe(voteText);
  });

	it("fails to peel with wrong node key", async () => {
		const tally = generateKeypair();
		const m1 = generateKeypair();
		const sender = generateKeypair();
		const wrongNode = generateKeypair();

		const voteBytes = encoder.encode("TEST");

		const onion = await buildOnion({
			vote: voteBytes,
			mixNodes: [{ publicKey: m1.publicKey }],
			tally: { publicKey: tally.publicKey },
			senderKeypair: sender,
		});

		await expect(
			peelOnionForNode(onion, wrongNode, sender.publicKey),
		).rejects.toThrow();
	});

	it("works with PQ enabled (hybrid mode)", async () => {
		// Temporarily enable PQ
		const originalPqEnabled = process.env.DAOMIX_PQ_ENABLED;
		process.env.DAOMIX_PQ_ENABLED = "true";

		try {
			await initPq();

			const tally = generateKeypair();
			const tallyPq = await generatePqKeypair();
			const m1 = generateKeypair();
			const m1Pq = await generatePqKeypair();
			const sender = generateKeypair();

			const voteText = "CANDIDATE_B_PQ";
			const voteBytes = encoder.encode(voteText);

			// Build onion with PQ public keys
			const onion = await buildOnion({
				vote: voteBytes,
				mixNodes: [
					{ publicKey: m1.publicKey, pqPublicKey: m1Pq.publicKey },
				],
				tally: {
					publicKey: tally.publicKey,
					pqPublicKey: tallyPq.publicKey,
				},
				senderKeypair: sender,
			});

			expect(onion).toBeTruthy();
			expect(onion.length).toBeGreaterThan(0);

			// The onion should be longer when PQ is enabled (includes PQ ciphertext)
			// PQ ciphertext is 1088 bytes = 2176 hex chars, so onion should be noticeably longer
			expect(onion.length).toBeGreaterThan(500); // Basic sanity check

			// Peel at mix node (with PQ SK for hybrid decryption)
			const peeledHex = await peelOnionForNode(
				onion,
				m1, // Use correct mix node keypair
				sender.publicKey,
				m1Pq.secretKey, // Provide PQ SK for hybrid decryption
			);

			expect(peeledHex).toBeTruthy();

			// Final decrypt at tally (with PQ SK)
			const final = await decryptFinalForTally(
				peeledHex,
				tally, // Use correct tally keypair
				sender.publicKey,
				tallyPq.secretKey, // Provide PQ SK for hybrid decryption
			);

			const decoded = decoder.decode(final);
			expect(decoded).toBe(voteText);
		} finally {
			// Restore original PQ setting
			if (originalPqEnabled !== undefined) {
				process.env.DAOMIX_PQ_ENABLED = originalPqEnabled;
			} else {
				delete process.env.DAOMIX_PQ_ENABLED;
			}
		}
	});
});

