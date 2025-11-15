import { expect } from "chai";
import { ethers } from "hardhat";
import axios from "axios";
import keccak256 from "keccak256";
import MerkleTree from "merkletreejs";
import { TextDecoder, TextEncoder } from "util";

import {
  initCrypto,
  generateKeypair,
  toHex,
  fromHex,
} from "@polokol/mixer/dist/src/crypto";
import {
  buildOnion,
  decryptFinalForTally,
} from "@polokol/mixer/dist/src/onion";
import type { HexString } from "@polokol/mixer/dist/src/shared";
import type { MixRequest, MixResponse } from "@polokol/mixer/dist/src/shared";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MIX_NODE_URL = process.env.MIX_NODE_URL || "http://localhost:4001";

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

/**
 * Get the mixer node's public key from the health endpoint
 */
async function getMixNodePublicKey(): Promise<Uint8Array> {
  const response = await axios.get(`${MIX_NODE_URL}/health`);
  const publicKeyHex = response.data.nodePublicKey as HexString;
  return fromHex(publicKeyHex);
}

/**
 * Mix ciphertexts using the actual HTTP mixer node
 * (Note: Detailed logging is done in the test itself)
 */
async function mixViaHttpNode(
  ciphertexts: HexString[],
  senderPublicKey: Uint8Array,
): Promise<HexString[]> {
  const reqBody: MixRequest = {
    ciphertexts,
    senderPublicKey: toHex(senderPublicKey),
  };

  const { data } = await axios.post<MixResponse>(`${MIX_NODE_URL}/mix`, reqBody, {
    timeout: 30_000,
  });

  if (!data || !Array.isArray(data.ciphertexts)) {
    throw new Error(`Invalid response from mix-node at ${MIX_NODE_URL}`);
  }

  return data.ciphertexts;
}

describe("DaoMix HTTP integration (with real mixer node)", function () {
  this.timeout(60_000);

  it("casts, mixes via HTTP node, decrypts, and tallies ALICE/BOB votes", async () => {
    console.log("\n" + "=".repeat(80));
    console.log("[STEP 1] Initializing crypto library...");
    console.log("=".repeat(80));
    await initCrypto();
    console.log("✅ Crypto library initialized\n");

    // Get the mixer node's public key from the health endpoint
    console.log("=".repeat(80));
    console.log("[STEP 2] Connecting to mixer node...");
    console.log("=".repeat(80));
    console.log(`📡 Fetching mixer node public key from ${MIX_NODE_URL}...`);
    const nodePublicKey = await getMixNodePublicKey();
    console.log(`✅ Mixer node public key: ${toHex(nodePublicKey)}\n`);

    console.log("=".repeat(80));
    console.log("[STEP 3] Setting up accounts and contract...");
    console.log("=".repeat(80));
    const [admin, voter] = await ethers.getSigners();
    console.log(`👤 Admin address: ${admin.address}`);
    console.log(`👤 Voter address: ${voter.address}`);

    const DaoMixVoting = await ethers.getContractFactory("DaoMixVoting");
    const voting = await DaoMixVoting.connect(admin).deploy();
    await voting.waitForDeployment();
    const contractAddress = await voting.getAddress();
    console.log(`📄 Contract deployed at: ${contractAddress}\n`);

    console.log("=".repeat(80));
    console.log("[STEP 4] Creating election...");
    console.log("=".repeat(80));
    const block = await ethers.provider.getBlock("latest");
    if (!block) {
      throw new Error("Missing latest block");
    }

    const now = block.timestamp;
    const registrationDeadline = now + 3_600;
    const votingDeadline = now + 7_200;
    console.log(`⏰ Current timestamp: ${now}`);
    console.log(`📅 Registration deadline: ${registrationDeadline} (${new Date(registrationDeadline * 1000).toISOString()})`);
    console.log(`📅 Voting deadline: ${votingDeadline} (${new Date(votingDeadline * 1000).toISOString()})`);

    const createTx = await voting
      .connect(admin)
      .createElection(
        "HTTP Integration Test Election",
        registrationDeadline,
        votingDeadline,
        admin.address,
      );
    const receipt = await createTx.wait();
    const electionId = 1;
    console.log(`✅ Election created with ID: ${electionId}`);
    console.log(`📝 Transaction hash: ${receipt?.hash}\n`);

    console.log("=".repeat(80));
    console.log("[STEP 5] Registering voter...");
    console.log("=".repeat(80));
    const registerTx = await voting
      .connect(admin)
      .registerVoter(electionId, await voter.getAddress());
    const registerReceipt = await registerTx.wait();
    console.log(`✅ Voter registered: ${await voter.getAddress()}`);
    console.log(`📝 Transaction hash: ${registerReceipt?.hash}\n`);

    console.log("=".repeat(80));
    console.log("[STEP 6] Generating cryptographic keypairs...");
    console.log("=".repeat(80));
    const sender = generateKeypair();
    const tally = generateKeypair();
    console.log(`🔑 Sender public key: ${toHex(sender.publicKey)}`);
    console.log(`🔑 Sender secret key: ${toHex(sender.secretKey).substring(0, 20)}...`);
    console.log(`🔑 Tally public key: ${toHex(tally.publicKey)}`);
    console.log(`🔑 Tally secret key: ${toHex(tally.secretKey).substring(0, 20)}...`);
    console.log(`🔑 Mix node public key: ${toHex(nodePublicKey)}\n`);

    const mixNodes = [{ publicKey: nodePublicKey }];
    const votes = ["ALICE", "BOB", "ALICE"];

    console.log("=".repeat(80));
    console.log("[STEP 7] Building and casting onion-encrypted votes...");
    console.log("=".repeat(80));
    console.log(`📊 Votes to cast: ${JSON.stringify(votes)}`);
    const onions: HexString[] = [];
    
    for (let i = 0; i < votes.length; i++) {
      const label = votes[i];
      console.log(`\n  [Vote ${i + 1}/${votes.length}] Building onion for: "${label}"`);
      const voteBytes = encoder.encode(label);
      console.log(`    📝 Plaintext bytes: ${toHex(voteBytes)}`);
      
      const onion = await buildOnion({
        vote: voteBytes,
        mixNodes,
        tally: { publicKey: tally.publicKey },
        senderKeypair: sender,
      });
      onions.push(onion);
      console.log(`    🧅 Onion ciphertext (${onion.length} chars): ${onion.substring(0, 66)}...`);

      const castTx = await voting
        .connect(voter)
        .castVote(electionId, onion);
      const castReceipt = await castTx.wait();
      console.log(`    ✅ Vote cast on-chain`);
      console.log(`    📝 Transaction hash: ${castReceipt?.hash}`);
    }
    console.log(`\n✅ All ${votes.length} votes cast successfully\n`);

    console.log("=".repeat(80));
    console.log("[STEP 8] Retrieving ballots from contract...");
    console.log("=".repeat(80));
    const ballots = (await voting.getBallots(electionId)) as HexString[];
    expect(ballots.length).to.equal(votes.length);
    console.log(`📦 Retrieved ${ballots.length} ballots from contract`);
    ballots.forEach((ballot, i) => {
      console.log(`  Ballot ${i + 1}: ${ballot.substring(0, 66)}... (${ballot.length} chars)`);
    });
    console.log();

    console.log("=".repeat(80));
    console.log("[STEP 9] Computing input Merkle root...");
    console.log("=".repeat(80));
    const inputRoot = buildMerkleRoot(ballots);
    expect(inputRoot).to.match(/^0x[0-9a-fA-F]{64}$/);
    console.log(`🌳 Input Merkle root: ${inputRoot}`);
    console.log(`📊 Number of ballots: ${ballots.length}\n`);

    // Mix via HTTP mixer node
    console.log("=".repeat(80));
    console.log("[STEP 10] Sending ballots to mixer node via HTTP...");
    console.log("=".repeat(80));
    console.log(`📡 Mixer node URL: ${MIX_NODE_URL}`);
    console.log(`📤 Sender public key: ${toHex(sender.publicKey)}`);
    console.log(`📦 Number of ciphertexts to mix: ${ballots.length}`);
    console.log(`📋 Ciphertexts being sent:`);
    ballots.forEach((cipher, i) => {
      console.log(`  [${i + 1}] ${cipher.substring(0, 66)}...`);
    });
    
    const reqBody: MixRequest = {
      ciphertexts: ballots,
      senderPublicKey: toHex(sender.publicKey),
    };
    console.log(`\n📤 Request body:`, JSON.stringify({
      ...reqBody,
      ciphertexts: reqBody.ciphertexts.map(c => c.substring(0, 20) + "..."),
    }, null, 2));

    const { data: mixResponse } = await axios.post<MixResponse>(`${MIX_NODE_URL}/mix`, reqBody, {
      timeout: 30_000,
    });

    if (!mixResponse || !Array.isArray(mixResponse.ciphertexts)) {
      throw new Error(`Invalid response from mix-node at ${MIX_NODE_URL}`);
    }

    const mixed = mixResponse.ciphertexts;
    console.log(`\n📥 Response from mixer node:`);
    console.log(`  ✅ Permutation: [${mixResponse.permutation.join(", ")}]`);
    console.log(`  🔐 Permutation commitment: ${mixResponse.permutationCommitment}`);
    console.log(`  📦 Mixed ciphertexts (${mixed.length}):`);
    mixed.forEach((cipher, i) => {
      console.log(`    [${i + 1}] ${cipher.substring(0, 66)}...`);
    });
    console.log();

    console.log("=".repeat(80));
    console.log("[STEP 11] Computing output Merkle root...");
    console.log("=".repeat(80));
    const outputRoot = buildMerkleRoot(mixed);
    expect(outputRoot).to.match(/^0x[0-9a-fA-F]{64}$/);
    console.log(`🌳 Output Merkle root: ${outputRoot}`);
    console.log(`📊 Number of mixed ciphertexts: ${mixed.length}\n`);

    // Decrypt and tally
    console.log("=".repeat(80));
    console.log("[STEP 12] Decrypting final ciphertexts and tallying votes...");
    console.log("=".repeat(80));
    const decrypted: string[] = [];
    const counts: Record<string, number> = {};
    
    for (let i = 0; i < mixed.length; i++) {
      const cipher = mixed[i];
      console.log(`\n  [Decrypt ${i + 1}/${mixed.length}]`);
      console.log(`    🔐 Ciphertext: ${cipher.substring(0, 66)}...`);
      
      const plain = await decryptFinalForTally(
        cipher,
        { secretKey: tally.secretKey, publicKey: tally.publicKey },
        sender.publicKey,
      );
      const label = decoder.decode(plain);
      console.log(`    🔓 Plaintext bytes: ${toHex(plain)}`);
      console.log(`    ✅ Decrypted vote: "${label}"`);
      
      decrypted.push(label);
      counts[label] = (counts[label] || 0) + 1;
    }

    console.log("\n" + "=".repeat(80));
    console.log("[STEP 13] Final Results");
    console.log("=".repeat(80));
    console.log(`📊 Decrypted votes: [${decrypted.map(v => `"${v}"`).join(", ")}]`);
    console.log(`📈 Tally counts:`);
    Object.entries(counts).forEach(([vote, count]) => {
      console.log(`  "${vote}": ${count}`);
    });
    console.log();

    expect(decrypted).to.have.length(votes.length);
    expect(counts["ALICE"]).to.equal(2);
    expect(counts["BOB"]).to.equal(1);
    expect(Object.keys(counts).sort()).to.deep.equal(["ALICE", "BOB"]);

    const sortedDecrypted = [...decrypted].sort();
    expect(sortedDecrypted).to.deep.equal([...votes].sort());

    console.log("=".repeat(80));
    console.log("✅ Full flow test completed successfully!");
    console.log("=".repeat(80) + "\n");
  });
});

