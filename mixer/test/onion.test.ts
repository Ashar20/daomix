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
});

