/**
 * DaoMix Ethereum Contract Voting Script
 * 
 * This script performs the complete DaoMix voting flow on an Ethereum contract:
 * 1. Creates an election on the contract
 * 2. Registers voters
 * 3. Casts multiple onion-encrypted votes to the contract
 * 4. Fetches ballots from the contract
 * 5. Shards ballots and sends them through mix nodes
 * 6. Reconstructs and decrypts votes
 * 7. Tallies votes and submits results to the contract
 * 
 * SETUP:
 * 
 * 1. Deploy the DaoMixVoting contract and set:
 *    export DAOMIX_CONTRACT_ADDRESS=<deployed_contract_address>
 *    export DAOMIX_RPC_URL=http://127.0.0.1:8545
 * 
 * 2. Set up admin and voter private keys:
 *    export DAOMIX_ADMIN_PRIVATE_KEY=<admin_private_key>
 *    export DAOMIX_VOTER_PRIVATE_KEYS=<voter1_key>,<voter2_key>,<voter3_key>
 *    export DAOMIX_VOTER_VOTES=ALICE,BOB,ALICE
 * 
 * 3. Configure mix nodes:
 *    export MIX_NODE_URLS=http://127.0.0.1:4001,http://127.0.0.1:4002
 *    export MIX_NODE_PUBLIC_KEYS=<pubkey1>,<pubkey2>
 * 
 * 4. Configure onion encryption keys:
 *    export DAOMIX_TALLY_PUBLIC_KEY=<tally_pubkey>
 *    export DAOMIX_TALLY_SECRET_KEY=<tally_secret>
 *    export DAOMIX_SENDER_PUBLIC_KEY=<sender_pubkey>
 *    export DAOMIX_SENDER_SECRET_KEY=<sender_secret>
 * 
 * 5. Optional: Configure sharding:
 *    export DAOMIX_SHARD_COUNT=3
 * 
 * RUN:
 *    npm run run:ethereum-contract-voting --workspace @polokol/mixer
 */

import "dotenv/config";
import { ethers } from "ethers";
import { TextEncoder, TextDecoder } from "util";
import keccak256 from "keccak256";
import MerkleTree from "merkletreejs";
import axios from "axios";

import {
  initCrypto,
  fromHex,
  toHex,
  Keypair,
} from "./crypto";
import {
  buildOnion,
  decryptFinalForTally,
} from "./onion";
import {
  loadOnionConfig,
  loadMixNodes,
  MixNodeConfig,
} from "./config";
import {
  shardCiphertext,
  reconstructFromShards,
  Shard,
  ShardWithMeta,
} from "./sharding";
import { MixRequest, MixResponse, HexString } from "./shared";
// Import contract types - adjust path based on workspace structure
// For now, we'll use ethers.Contract directly with ABI

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Build Merkle root from hex strings
 */
function buildMerkleRoot(values: HexString[]): HexString {
  if (values.length === 0) {
    return `0x${"00".repeat(32)}` as HexString;
  }

  const leaves = values.map((hex) => {
    const raw = Buffer.from(hex.replace(/^0x/, ""), "hex");
    return keccak256(raw);
  });

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot();
  return `0x${root.toString("hex")}` as HexString;
}

/**
 * Get shard count from environment or return default
 */
function getShardCount(): number {
  const env = process.env.DAOMIX_SHARD_COUNT;
  const parsed = env ? parseInt(env, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3; // sensible default
  }
  return parsed;
}

/**
 * Run the sharded mix chain over shards instead of whole ballots.
 * 
 * This function:
 * 1. Shards each ballot ciphertext into k shards
 * 2. Sends all shards through each mix node in sequence
 * 3. Tracks which shard belongs to which original ballot through all permutations
 * 4. Reconstructs final ciphertexts per ballot from the mixed shards
 */
async function runShardedMixChain(
  ciphertexts: HexString[],
  senderPublicKey: HexString,
  mixNodes: MixNodeConfig[],
  shardCount: number,
): Promise<HexString[]> {
  if (mixNodes.length === 0) {
    throw new Error("No mix-nodes configured");
  }

  if (ciphertexts.length === 0) {
    return [];
  }

  console.log(`[DaoMix] Starting sharded mix chain with ${shardCount} shards per ballot, ${mixNodes.length} mix nodes`);

  // 1) Build ShardWithMeta[] for all ballots
  const shardsWithMeta: ShardWithMeta[] = [];
  for (let messageIndex = 0; messageIndex < ciphertexts.length; messageIndex++) {
    const ct = ciphertexts[messageIndex];
    const shards = shardCiphertext(ct, shardCount);
    for (const shard of shards) {
      shardsWithMeta.push({
        ...shard,
        messageIndex,
      });
    }
  }

  if (shardsWithMeta.length === 0) {
    return [];
  }

  console.log(`[DaoMix] Created ${shardsWithMeta.length} shards from ${ciphertexts.length} ballots`);

  // 2) Extract the shard ciphertexts as our working batch
  let currentCiphertexts: HexString[] = shardsWithMeta.map((s) => s.data);

  // 3) For each mix node, call /mix and update both ciphertexts and shard metadata
  for (const node of mixNodes) {
    const url = node.url.endsWith("/mix") ? node.url : `${node.url}/mix`;

    const reqBody: MixRequest = {
      ciphertexts: currentCiphertexts,
      senderPublicKey,
    };

    console.log(`[DaoMix] Sending ${currentCiphertexts.length} shards to mix node at ${url}...`);

    const { data } = await axios.post<MixResponse>(url, reqBody, {
      timeout: 60_000,
    });

    if (!Array.isArray(data.ciphertexts) || !Array.isArray(data.permutation)) {
      throw new Error(`Invalid /mix response from ${url}`);
    }
    if (data.ciphertexts.length !== currentCiphertexts.length) {
      throw new Error(`/mix response size mismatch from ${url}`);
    }
    if (data.permutation.length !== currentCiphertexts.length) {
      throw new Error(`/mix permutation size mismatch from ${url}`);
    }

    // Apply permutation to shard metadata
    const newShardsWithMeta: ShardWithMeta[] = new Array(shardsWithMeta.length);
    const newCiphertexts: HexString[] = new Array(shardsWithMeta.length);

    for (let i = 0; i < data.ciphertexts.length; i++) {
      const srcIndex = data.permutation[i];
      newCiphertexts[i] = data.ciphertexts[i];
      newShardsWithMeta[i] = {
        ...shardsWithMeta[srcIndex],
        data: data.ciphertexts[i],
      };
    }

    shardsWithMeta.splice(0, shardsWithMeta.length, ...newShardsWithMeta);
    currentCiphertexts = newCiphertexts;

    console.log(
      `[DaoMix] ✅ Mixed via ${node.url}, permutationCommitment=${data.permutationCommitment}, totalShards=${shardsWithMeta.length}`
    );
  }

  // 4) Group shards back by messageIndex and reconstruct each ballot ciphertext
  const shardsByMessage = new Map<number, Shard[]>();
  for (const shard of shardsWithMeta) {
    const arr = shardsByMessage.get(shard.messageIndex) ?? [];
    arr.push({
      shardId: shard.shardId,
      shardIndex: shard.shardIndex,
      totalShards: shard.totalShards,
      data: shard.data,
    });
    shardsByMessage.set(shard.messageIndex, arr);
  }

  const finalCiphertexts: HexString[] = [];
  for (let messageIndex = 0; messageIndex < ciphertexts.length; messageIndex++) {
    const shards = shardsByMessage.get(messageIndex) ?? [];
    if (shards.length === 0) {
      throw new Error(`Missing shards for messageIndex=${messageIndex}`);
    }
    const reconstructed = reconstructFromShards(shards);
    finalCiphertexts.push(reconstructed);
  }

  console.log(`[DaoMix] ✅ Reconstructed ${finalCiphertexts.length} ballots from shards`);

  return finalCiphertexts;
}

/**
 * Main function to run the complete DaoMix voting flow on Ethereum contract
 */
async function main() {
  try {
    await initCrypto();

    // 1) Load configuration
    const rpcUrl = process.env.DAOMIX_RPC_URL || "http://127.0.0.1:8545";
    const contractAddress = process.env.DAOMIX_CONTRACT_ADDRESS;
    const adminPrivateKey = process.env.DAOMIX_ADMIN_PRIVATE_KEY;
    const voterPrivateKeysStr = process.env.DAOMIX_VOTER_PRIVATE_KEYS;
    const voterVotesStr = process.env.DAOMIX_VOTER_VOTES;

    if (!contractAddress) {
      throw new Error("DAOMIX_CONTRACT_ADDRESS is not set");
    }
    if (!adminPrivateKey) {
      throw new Error("DAOMIX_ADMIN_PRIVATE_KEY is not set");
    }
    if (!voterPrivateKeysStr) {
      throw new Error("DAOMIX_VOTER_PRIVATE_KEYS is not set");
    }
    if (!voterVotesStr) {
      throw new Error("DAOMIX_VOTER_VOTES is not set");
    }

    const voterPrivateKeys = voterPrivateKeysStr.split(",").map((k) => k.trim()).filter(Boolean);
    const voterVotes = voterVotesStr.split(",").map((v) => v.trim()).filter(Boolean);

    if (voterPrivateKeys.length !== voterVotes.length) {
      throw new Error(
        `DAOMIX_VOTER_PRIVATE_KEYS length (${voterPrivateKeys.length}) != DAOMIX_VOTER_VOTES length (${voterVotes.length})`
      );
    }

    const onionCfg = loadOnionConfig();
    const mixNodes = loadMixNodes();
    const shardCount = getShardCount();

    console.log(`\n🎯 Starting DaoMix Ethereum Contract Voting Pipeline\n`);
    console.log(`📋 Contract: ${contractAddress}`);
    console.log(`📋 RPC: ${rpcUrl}`);
    console.log(`📋 Voters: ${voterPrivateKeys.length}`);
    console.log(`📋 Mix Nodes: ${mixNodes.length}`);
    console.log(`📋 Shard Count: ${shardCount}\n`);

    // 2) Connect to Ethereum provider and contract
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // Create wallet with nonce manager disabled to avoid caching issues
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    // Contract ABI for DaoMixVoting
    const contractABI = [
      "function createElection(string name, uint256 registrationDeadline, uint256 votingDeadline, address tallyAuthority) external returns (uint256)",
      "function registerVoter(uint256 electionId, address voter) external",
      "function castVote(uint256 electionId, bytes calldata ballotCipher) external",
      "function getBallots(uint256 electionId) external view returns (bytes[])",
      "function setMixCommitments(uint256 electionId, bytes32 inputRoot, bytes32 outputRoot) external",
      "function submitTally(uint256 electionId, string calldata resultUri, bytes32 resultHash) external",
      "function elections(uint256) external view returns (uint256 id, string name, uint256 registrationDeadline, uint256 votingDeadline, address admin, address tallyAuthority, bytes32 commitmentInputRoot, bytes32 commitmentOutputRoot, bool finalized)",
      "function electionCount() external view returns (uint256)",
    ];

    const contract = new ethers.Contract(contractAddress, contractABI, adminWallet);
    
    // Helper function to send transaction with proper nonce handling
    const sendTxWithNonce = async (txPromise: Promise<any>) => {
      const tx = await txPromise;
      const receipt = await tx.wait();
      // Wait a bit for the nonce to update in the provider
      await new Promise(resolve => setTimeout(resolve, 200));
      return receipt;
    };

    // Get tally authority address (use admin for simplicity, or set via env)
    const tallyAuthorityAddress = process.env.DAOMIX_TALLY_AUTHORITY_ADDRESS || adminWallet.address;

    // 3) Create election
    const block = await provider.getBlock("latest");
    if (!block) {
      throw new Error("Failed to get latest block");
    }

    const now = BigInt(block.timestamp);
    const registrationDeadline = now + BigInt(3600); // 1 hour
    const votingDeadline = now + BigInt(7200); // 2 hours

    console.log(`📝 Creating election...`);
    const createTx = await contract.createElection(
      "DaoMix Test Election",
      registrationDeadline,
      votingDeadline,
      tallyAuthorityAddress
    );
    const createReceipt = await createTx.wait();
    const electionId = await contract.electionCount();
    console.log(`✅ Election created with ID: ${electionId}, tx: ${createReceipt.hash}\n`);

    // 4) Register voters
    console.log(`👥 Registering ${voterPrivateKeys.length} voters...`);
    const voterWallets = voterPrivateKeys.map((pk) => new ethers.Wallet(pk, provider));

    // Track nonce manually to avoid conflicts - get it AFTER createElection is confirmed
    // Use "latest" to get the confirmed nonce, not pending
    let currentNonce = await provider.getTransactionCount(adminWallet.address, "latest");
    
    for (let i = 0; i < voterWallets.length; i++) {
      const voter = voterWallets[i];
      try {
        const freshContract = new ethers.Contract(contractAddress, contractABI, adminWallet);
        const regTx = await freshContract.registerVoter(electionId, voter.address, { nonce: currentNonce });
        const receipt = await regTx.wait();
        currentNonce++; // Increment for next transaction
        console.log(`  ✅ Registered voter ${i + 1}/${voterPrivateKeys.length}: ${voter.address} (will vote: ${voterVotes[i]}), tx: ${receipt.hash}`);
      } catch (err: any) {
        if (err?.message?.includes("already registered") || err?.message?.includes("AlreadyRegistered")) {
          console.log(`  ⚠️  Voter ${voter.address} already registered, skipping`);
        } else {
          // If nonce error, refresh nonce and retry
          if (err?.code === "NONCE_EXPIRED" || err?.message?.includes("nonce")) {
            currentNonce = await provider.getTransactionCount(adminWallet.address, "pending");
            const freshContract = new ethers.Contract(contractAddress, contractABI, adminWallet);
            const regTx = await freshContract.registerVoter(electionId, voter.address, { nonce: currentNonce });
            const receipt = await regTx.wait();
            currentNonce++;
            console.log(`  ✅ Registered voter ${i + 1}/${voterPrivateKeys.length}: ${voter.address} (will vote: ${voterVotes[i]}), tx: ${receipt.hash}`);
          } else {
            throw err;
          }
        }
      }
    }
    console.log();

    // 5) Cast onion-encrypted votes
    console.log(`🗳️  Casting ${voterPrivateKeys.length} onion-encrypted ballots...`);

    const senderSecretBytes = fromHex(onionCfg.senderSecretKey);
    const senderPublicBytes = fromHex(onionCfg.senderPublicKey);
    const senderKeypair: Keypair = {
      secretKey: senderSecretBytes,
      publicKey: senderPublicBytes,
    };

    const tallyPublicBytes = fromHex(onionCfg.tallyPublicKey);
    const mixNodePublics = mixNodes.map((n) => ({
      publicKey: fromHex(n.publicKey),
    }));

    for (let i = 0; i < voterWallets.length; i++) {
      const voter = voterWallets[i];
      const vote = voterVotes[i];

      // Build onion-encrypted ciphertext
      const voteBytes = encoder.encode(vote);
      const onionHex = await buildOnion({
        vote: voteBytes,
        mixNodes: mixNodePublics,
        tally: { publicKey: tallyPublicBytes },
        senderKeypair,
      });

      // Cast vote on contract
      // Let ethers handle nonce automatically
      const voterContract = new ethers.Contract(contractAddress, contractABI, voter);
      const castTx = await voterContract.castVote(electionId, onionHex);
      const castReceipt = await castTx.wait();
      // Small delay to ensure transaction is fully processed
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(`  ✅ Cast vote ${i + 1}/${voterPrivateKeys.length} from ${voter.address} ("${vote}"), tx: ${castReceipt.hash}`);
    }
    console.log();

    // 6) Fetch ballots from contract
    console.log(`📥 Fetching ballots from contract...`);
    const ballots = await contract.getBallots(electionId);
    console.log(`✅ Fetched ${ballots.length} ballots from contract\n`);

    if (ballots.length === 0) {
      console.log(`⚠️  No ballots found, exiting`);
      return;
    }

    // Convert to HexString[]
    const ballotsHex: HexString[] = ballots.map((b: string) => b as HexString);

    // 7) Compute input Merkle root
    const inputRoot = buildMerkleRoot(ballotsHex);
    console.log(`[DaoMix] Input Merkle root: ${inputRoot}\n`);

    // 8) Send ballots through mix chain
    // Note: Sharding is disabled for now as mix nodes expect full ciphertexts
    // TODO: Implement proper sharding support in mix nodes
    console.log(`🔄 Running mix chain (sharding disabled - using full ciphertexts)...`);
    const senderPublicKeyHex = onionCfg.senderPublicKey;
    
    // Use non-sharded mixing for now
    let currentCiphertexts = ballotsHex;
    for (const node of mixNodes) {
      const url = node.url.endsWith("/mix") ? node.url : `${node.url}/mix`;
      const reqBody: MixRequest = {
        ciphertexts: currentCiphertexts,
        senderPublicKey: senderPublicKeyHex,
      };
      
      console.log(`[DaoMix] Sending ${currentCiphertexts.length} ciphertexts to mix node at ${url}...`);
      const { data } = await axios.post<MixResponse>(url, reqBody, {
        timeout: 60_000,
      });
      
      if (!Array.isArray(data.ciphertexts)) {
        throw new Error(`Invalid /mix response from ${url}`);
      }
      
      currentCiphertexts = data.ciphertexts;
      console.log(`[DaoMix] ✅ Mixed via ${node.url}, permutationCommitment=${data.permutationCommitment}`);
    }
    
    const finalCiphertextsHex = currentCiphertexts;

    // Sanity check
    if (finalCiphertextsHex.length !== ballotsHex.length) {
      throw new Error(
        `Sharded mix chain returned ${finalCiphertextsHex.length} ciphertexts, expected ${ballotsHex.length}`
      );
    }

    // 9) Compute output Merkle root
    const outputRoot = buildMerkleRoot(finalCiphertextsHex);
    console.log(`[DaoMix] Output Merkle root: ${outputRoot}\n`);

    // 10) Decrypt final ciphertexts and tally votes
    console.log(`🔓 Decrypting and tallying votes...`);
    const tallyKeypair: Keypair = {
      secretKey: fromHex(onionCfg.tallySecretKey),
      publicKey: fromHex(onionCfg.tallyPublicKey),
    };

    const decryptedVotes: string[] = [];
    const counts: Record<string, number> = {};

    for (const cipher of finalCiphertextsHex) {
      const plainBytes = await decryptFinalForTally(
        cipher,
        tallyKeypair,
        senderPublicBytes,
      );
      const vote = decoder.decode(plainBytes);
      decryptedVotes.push(vote);
      counts[vote] = (counts[vote] || 0) + 1;
    }

    console.log(`[DaoMix] Decrypted votes:`, decryptedVotes);
    console.log(`[DaoMix] Tally counts:`, counts);
    console.log();

    // 11) Build result payload and hash
    const resultUri = process.env.DAOMIX_RESULT_URI || `ipfs://daomix-demo/${electionId}`;
    const resultPayload = {
      electionId: Number(electionId),
      inputRoot,
      outputRoot,
      ballotCount: ballots.length,
      decryptedVotes,
      counts,
    };
    const resultHashHex: HexString =
      (`0x${keccak256(Buffer.from(JSON.stringify(resultPayload))).toString("hex")}`) as HexString;

    console.log(`[DaoMix] Result URI: ${resultUri}`);
    console.log(`[DaoMix] Result hash: ${resultHashHex}\n`);

    // 12) Advance time to pass voting deadline (for testing only)
    const election = await contract.elections(electionId);
    const currentBlock = await provider.getBlock("latest");
    if (currentBlock && BigInt(currentBlock.timestamp) < election.votingDeadline) {
      const timeToAdvance = Number(election.votingDeadline - BigInt(currentBlock.timestamp) + BigInt(1));
      console.log(`⏳ Advancing blockchain time by ${timeToAdvance} seconds to pass voting deadline...`);
      try {
        // Try to advance time using Hardhat's evm_increaseTime
        await provider.send("evm_increaseTime", [Number(timeToAdvance)]);
        await provider.send("evm_mine", []);
        console.log(`✅ Time advanced, voting deadline has passed\n`);
      } catch (err) {
        console.log(`⚠️  Could not advance time automatically. Please wait for voting deadline or advance time manually.\n`);
        throw new Error("Voting deadline has not passed. Cannot submit mix commitments.");
      }
    }

    // 13) Commit mix commitments to contract
    console.log(`📝 Submitting mix commitments to contract...`);
    const commitmentTx = await contract.setMixCommitments(electionId, inputRoot, outputRoot);
    await commitmentTx.wait();
    console.log(`✅ Mix commitments submitted, tx: ${commitmentTx.hash}\n`);

    // 14) Submit tally to contract
    console.log(`📝 Submitting tally results to contract...`);
    const tallyWallet = new ethers.Wallet(
      process.env.DAOMIX_TALLY_PRIVATE_KEY || adminPrivateKey,
      provider
    );
    // Get fresh nonce for tally submission
    const tallyNonce = await provider.getTransactionCount(tallyWallet.address, "latest");
    const tallyContract = new ethers.Contract(contractAddress, contractABI, tallyWallet);
    const tallyTx = await tallyContract.submitTally(electionId, resultUri, resultHashHex, { nonce: tallyNonce });
    await tallyTx.wait();
    console.log(`✅ Tally submitted, tx: ${tallyTx.hash}\n`);

    // 15) Verify finalization
    const finalElection = await contract.elections(electionId);
    console.log(`🎯 Election finalized: ${finalElection.finalized}`);
    console.log(`🎯 Final tally counts:`, counts);
    console.log(`\n✅ DaoMix Ethereum Contract Voting Pipeline Complete!`);

  } catch (err) {
    console.error("❌ DaoMix Ethereum Contract Voting Pipeline failed:", err);
    process.exit(1);
  }
}

void main();

