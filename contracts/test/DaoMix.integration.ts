import { expect } from "chai";
import { ethers } from "hardhat";
import keccak256 from "keccak256";
import MerkleTree from "merkletreejs";
import { TextDecoder, TextEncoder } from "util";

import {
  initCrypto,
  generateKeypair,
  toHex,
  decryptLayer,
  Keypair,
} from "@polokol/mixer/dist/src/crypto";
import {
  buildOnion,
  decryptFinalForTally,
} from "@polokol/mixer/dist/src/onion";
import type { HexString } from "@polokol/mixer/dist/src/shared";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function buildMerkleRoot(values: HexString[]): HexString {
  if (values.length === 0) {
    return `0x${"00".repeat(32)}` as HexString;
  }

  const leaves = values.map((hex) =>
    keccak256(Buffer.from(hex.replace(/^0x/, ""), "hex")),
  );

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot();
  return (`0x${root.toString("hex")}`) as HexString;
}

async function oneNodeMix(
  ciphertexts: HexString[],
  nodeKeypair: Keypair,
  senderPublicKey: Uint8Array,
): Promise<HexString[]> {
  const peeled: HexString[] = [];

  for (const cipher of ciphertexts) {
    const innerBytes = await decryptLayer(
      nodeKeypair.secretKey,
      senderPublicKey,
      cipher,
    );
    peeled.push(toHex(innerBytes));
  }

  const permutation = [...peeled.keys()];
  for (let i = permutation.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }

  return permutation.map((index) => peeled[index]);
}

describe("DaoMix end-to-end integration", function () {
  this.timeout(60_000);

  it("casts, mixes, decrypts, and tallies ALICE/BOB votes", async () => {
    await initCrypto();

    const [admin, voter] = await ethers.getSigners();

    const DaoMixVoting = await ethers.getContractFactory("DaoMixVoting");
    const voting = await DaoMixVoting.connect(admin).deploy();
    await voting.waitForDeployment();

    const block = await ethers.provider.getBlock("latest");
    if (!block) {
      throw new Error("Missing latest block");
    }

    const now = block.timestamp;
    const registrationDeadline = now + 3_600;
    const votingDeadline = now + 7_200;

    const createTx = await voting
      .connect(admin)
      .createElection(
        "Integration Test Election",
        registrationDeadline,
        votingDeadline,
        admin.address,
      );
    await createTx.wait();
    const electionId = 1;

    const registerTx = await voting
      .connect(admin)
      .registerVoter(electionId, await voter.getAddress());
    await registerTx.wait();

    const sender = generateKeypair();
    const tally = generateKeypair();
    const node = generateKeypair();

    const votes = ["ALICE", "BOB", "ALICE"];
    const mixNodes = [{ publicKey: node.publicKey }];

    for (const label of votes) {
      const onion = await buildOnion({
        vote: encoder.encode(label),
        mixNodes,
        tally: { publicKey: tally.publicKey },
        senderKeypair: sender,
      });

      const castTx = await voting
        .connect(voter)
        .castVote(electionId, onion);
      await castTx.wait();
    }

    const ballots = (await voting.getBallots(electionId)) as HexString[];
    expect(ballots.length).to.equal(votes.length);

    const inputRoot = buildMerkleRoot(ballots);
    expect(inputRoot).to.match(/^0x[0-9a-fA-F]{64}$/);

    const mixed = await oneNodeMix(ballots, node, sender.publicKey);
    const outputRoot = buildMerkleRoot(mixed);
    expect(outputRoot).to.match(/^0x[0-9a-fA-F]{64}$/);

    const decrypted: string[] = [];
    const counts: Record<string, number> = {};
    for (const cipher of mixed) {
      const plain = await decryptFinalForTally(
        cipher,
        { secretKey: tally.secretKey, publicKey: tally.publicKey },
        sender.publicKey,
      );
      const label = decoder.decode(plain);
      decrypted.push(label);
      counts[label] = (counts[label] || 0) + 1;
    }

    expect(decrypted).to.have.length(votes.length);
    expect(counts["ALICE"]).to.equal(2);
    expect(counts["BOB"]).to.equal(1);
    expect(Object.keys(counts).sort()).to.deep.equal(["ALICE", "BOB"]);

    const sortedDecrypted = [...decrypted].sort();
    expect(sortedDecrypted).to.deep.equal([...votes].sort());
  });
});

