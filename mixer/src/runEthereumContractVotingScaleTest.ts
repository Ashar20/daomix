/**
 * DaoMix Ethereum Contract Voting - Scale Test Script
 * 
 * This script tests the DaoMix voting system with 100 voters and 100 votes.
 * It performs the complete voting flow:
 * 1. Creates an election on the contract
 * 2. Registers 100 voters
 * 3. Casts 100 onion-encrypted votes
 * 4. Fetches ballots from the contract
 * 5. Sends ballots through mix nodes
 * 6. Reconstructs and decrypts votes
 * 7. Tallies votes and submits results to the contract
 * 
 * SETUP:
 * 
 * 1. Start Hardhat node:
 *    cd contracts && npx hardhat node
 * 
 * 2. Deploy the contract and set:
 *    export DAOMIX_CONTRACT_ADDRESS=<deployed_contract_address>
 *    export DAOMIX_RPC_URL=http://127.0.0.1:8545
 * 
 * 3. Set up admin private key:
 *    export DAOMIX_ADMIN_PRIVATE_KEY=<admin_private_key>
 *    (or use Hardhat default: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
 * 
 * 4. Configure mix nodes:
 *    export MIX_NODE_URLS=http://127.0.0.1:4001,http://127.0.0.1:4002
 *    export MIX_NODE_PUBLIC_KEYS=<pubkey1>,<pubkey2>
 * 
 * 5. Configure onion encryption keys (or let script generate them):
 *    export DAOMIX_TALLY_PUBLIC_KEY=<tally_pubkey>
 *    export DAOMIX_TALLY_SECRET_KEY=<tally_secret>
 *    export DAOMIX_SENDER_PUBLIC_KEY=<sender_pubkey>
 *    export DAOMIX_SENDER_SECRET_KEY=<sender_secret>
 * 
 * 6. Optional: Configure number of voters:
 *    export DAOMIX_SCALE_TEST_VOTERS=100  # Default: 100
 * 
 * RUN:
 *    npm run run:ethereum-contract-voting-scale-test --workspace @polokol/mixer
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
  generateKeypair,
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
import { MixRequest, MixResponse, HexString } from "./shared";

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
 * Generate random vote choice from a list of candidates
 */
function generateRandomVote(candidates: string[]): string {
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Generate multiple voter accounts using deterministic derivation
 */
async function generateVoterAccounts(
  count: number, 
  provider: ethers.Provider,
  adminWallet: ethers.Wallet
): Promise<ethers.Wallet[]> {
  const wallets: ethers.Wallet[] = [];
  
  // Use Hardhat's default accounts (all 20 pre-funded accounts)
  // For more accounts, derive deterministically from a seed
  const hardhatAccounts = [
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Account #1
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Account #2
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Account #3
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f873f9c309c1a5b04c927", // Account #4
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // Account #5
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // Account #6
    "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // Account #7
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // Account #8
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff04d547c", // Account #9
    "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897", // Account #10
    "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82", // Account #11
    "0xa267530f49f8280200edf313ee7af6b827f2a8bce2898711eac2e8fd27869f32", // Account #12
    "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd", // Account #13
    "0xc526ee95bf44d8fc405a158bb884d9d1238f99f660608117800210fd0191c52f", // Account #14
    "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61", // Account #15
    "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0", // Account #16
    "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b1e7cdc1b30b8634dc", // Account #17
    "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0", // Account #18
    "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e", // Account #19
    "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199ebfbc7a8a508883f0e6c0e0e", // Account #20
  ];

  // Use Hardhat accounts first
  for (let i = 0; i < Math.min(count, hardhatAccounts.length); i++) {
    wallets.push(new ethers.Wallet(hardhatAccounts[i], provider));
  }

  // Generate additional accounts deterministically if needed
  if (count > hardhatAccounts.length) {
    const seed = "daomix-scale-test-seed-2024";
    const additionalCount = count - hardhatAccounts.length;
    console.log(`  ⚠️  Generating ${additionalCount} additional accounts (funding from admin)...`);
    
    for (let i = hardhatAccounts.length; i < count; i++) {
      // Derive private key from seed + index using keccak256
      const seedBytes = encoder.encode(`${seed}-${i}`);
      const hash = keccak256(Buffer.from(seedBytes));
      const privateKey = `0x${hash.toString("hex")}`;
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // Fund the account with 0.1 ETH from admin
      // Get fresh nonce for each funding transaction
      try {
        const fundingNonce = await provider.getTransactionCount(adminWallet.address, "latest");
        const fundTx = await adminWallet.sendTransaction({
          to: wallet.address,
          value: ethers.parseEther("0.1"),
          nonce: fundingNonce,
        });
        await fundTx.wait();
      } catch (err) {
        console.log(`  ⚠️  Could not fund account ${i}, continuing anyway`);
      }
      
      wallets.push(wallet);
      
      if ((i - hardhatAccounts.length + 1) % 20 === 0) {
        console.log(`  ✅ Generated and funded ${i - hardhatAccounts.length + 1}/${additionalCount} additional accounts...`);
      }
    }
  }

  return wallets;
}

/**
 * Main function to run the scale test
 */
async function main() {
  try {
    await initCrypto();

    // 1) Load configuration
    const rpcUrl = process.env.DAOMIX_RPC_URL || "http://127.0.0.1:8545";
    const contractAddress = process.env.DAOMIX_CONTRACT_ADDRESS;
    const adminPrivateKey = process.env.DAOMIX_ADMIN_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const voterCount = parseInt(process.env.DAOMIX_SCALE_TEST_VOTERS || "100", 10);

    if (!contractAddress) {
      throw new Error("DAOMIX_CONTRACT_ADDRESS is not set");
    }

    // Generate or load onion config
    let onionCfg;
    try {
      onionCfg = loadOnionConfig();
    } catch (err) {
      console.log("⚠️  Onion config not found, generating test keys...");
      const tally = generateKeypair();
      const sender = generateKeypair();
      onionCfg = {
        tallyPublicKey: toHex(tally.publicKey),
        tallySecretKey: toHex(tally.secretKey),
        senderPublicKey: toHex(sender.publicKey),
        senderSecretKey: toHex(sender.secretKey),
      };
      console.log("✅ Generated test encryption keys");
    }

    const mixNodes = loadMixNodes();

    // Define candidates for votes
    const candidates = ["ALICE", "BOB", "CHARLIE", "DAVE", "EVE"];

    console.log(`\n🎯 Starting DaoMix Scale Test with ${voterCount} Voters\n`);
    console.log(`📋 Contract: ${contractAddress}`);
    console.log(`📋 RPC: ${rpcUrl}`);
    console.log(`📋 Voters: ${voterCount}`);
    console.log(`📋 Mix Nodes: ${mixNodes.length}`);
    console.log(`📋 Candidates: ${candidates.join(", ")}\n`);

    // 2) Connect to Ethereum provider and contract
    const provider = new ethers.JsonRpcProvider(rpcUrl);
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

    // Get tally authority address
    const tallyAuthorityAddress = process.env.DAOMIX_TALLY_AUTHORITY_ADDRESS || adminWallet.address;

    // 3) Generate voter accounts
    console.log(`👥 Generating ${voterCount} voter accounts...`);
    const voterWallets = await generateVoterAccounts(voterCount, provider, adminWallet);
    console.log(`✅ Generated ${voterWallets.length} voter accounts\n`);

    // 4) Generate random votes
    console.log(`🗳️  Generating ${voterCount} random votes...`);
    const votes: string[] = [];
    const voteCounts: Record<string, number> = {};
    for (let i = 0; i < voterCount; i++) {
      const vote = generateRandomVote(candidates);
      votes.push(vote);
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    }
    console.log(`✅ Vote distribution:`, voteCounts);
    console.log();

    // 5) Create election
    const block = await provider.getBlock("latest");
    if (!block) {
      throw new Error("Failed to get latest block");
    }

    const now = BigInt(block.timestamp);
    const registrationDeadline = now + BigInt(3600); // 1 hour
    const votingDeadline = now + BigInt(7200); // 2 hours

    console.log(`📝 Creating election...`);
    const createTx = await contract.createElection(
      `DaoMix Scale Test Election (${voterCount} voters)`,
      registrationDeadline,
      votingDeadline,
      tallyAuthorityAddress
    );
    const createReceipt = await createTx.wait();
    const electionId = await contract.electionCount();
    console.log(`✅ Election created with ID: ${electionId}, tx: ${createReceipt.hash}\n`);

    // 6) Register voters sequentially to avoid nonce issues
    console.log(`👥 Registering ${voterCount} voters...`);
    let registeredCount = 0;

    for (let i = 0; i < voterWallets.length; i++) {
      const voter = voterWallets[i];
      let success = false;
      let retries = 0;
      const maxRetries = 3;

      while (!success && retries < maxRetries) {
        try {
          // Always get fresh nonce before each transaction
          const currentNonce = await provider.getTransactionCount(adminWallet.address, "latest");
          const freshContract = new ethers.Contract(contractAddress, contractABI, adminWallet);
          const regTx = await freshContract.registerVoter(electionId, voter.address, { nonce: currentNonce });
          const receipt = await regTx.wait();
          registeredCount++;
          success = true;
        } catch (err: any) {
          if (err?.message?.includes("already registered")) {
            registeredCount++;
            success = true;
          } else if (err?.code === "NONCE_EXPIRED" || err?.message?.includes("nonce") || err?.error?.message?.includes("nonce")) {
            // Nonce issue - wait a bit and retry with fresh nonce
            retries++;
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              console.error(`  ❌ Failed to register voter ${i + 1} (${voter.address}) after ${maxRetries} retries:`, err.message || err.error?.message);
              throw err;
            }
          } else {
            console.error(`  ❌ Failed to register voter ${i + 1} (${voter.address}):`, err.message || err.error?.message);
            throw err;
          }
        }
      }
      
      if ((i + 1) % 25 === 0 || i + 1 === voterWallets.length) {
        console.log(`  ✅ Registered ${i + 1}/${voterWallets.length} voters...`);
      }
    }
    console.log(`✅ Registered ${registeredCount} voters\n`);

    // 7) Prepare onion encryption
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

    // 8) Cast votes sequentially to avoid nonce conflicts
    console.log(`🗳️  Casting ${voterCount} onion-encrypted ballots...`);
    let castCount = 0;

    for (let i = 0; i < voterWallets.length; i++) {
      const voter = voterWallets[i];
      const vote = votes[i];
      
      try {
        const voteBytes = encoder.encode(vote);
        const onionHex = await buildOnion({
          vote: voteBytes,
          mixNodes: mixNodePublics,
          tally: { publicKey: tallyPublicBytes },
          senderKeypair,
        });

        const voterNonce = await provider.getTransactionCount(voter.address, "latest");
        const voterContract = new ethers.Contract(contractAddress, contractABI, voter);
        const castTx = await voterContract.castVote(electionId, onionHex, { nonce: voterNonce });
        const castReceipt = await castTx.wait();
        castCount++;
      } catch (err: any) {
        console.error(`  ❌ Failed to cast vote ${i + 1} from ${voter.address}:`, err.message);
        // Continue with next voter
      }

      if ((i + 1) % 25 === 0 || i + 1 === voterWallets.length) {
        console.log(`  ✅ Cast ${i + 1}/${voterWallets.length} votes...`);
      }
    }
    console.log(`✅ Cast ${castCount} votes\n`);

    // 9) Fetch ballots from contract
    console.log(`📥 Fetching ballots from contract...`);
    const ballots = await contract.getBallots(electionId);
    console.log(`✅ Fetched ${ballots.length} ballots from contract\n`);

    if (ballots.length === 0) {
      console.log(`⚠️  No ballots found, exiting`);
      return;
    }

    // Convert to HexString[]
    const ballotsHex: HexString[] = ballots.map((b: string) => b as HexString);

    // 10) Compute input Merkle root
    const inputRoot = buildMerkleRoot(ballotsHex);
    console.log(`[DaoMix] Input Merkle root: ${inputRoot}\n`);

    // 11) Send ballots through mix chain
    console.log(`🔄 Running mix chain with ${ballotsHex.length} ballots...`);
    const senderPublicKeyHex = onionCfg.senderPublicKey;
    
    let currentCiphertexts = ballotsHex;
    for (const node of mixNodes) {
      const url = node.url.endsWith("/mix") ? node.url : `${node.url}/mix`;
      const reqBody: MixRequest = {
        ciphertexts: currentCiphertexts,
        senderPublicKey: senderPublicKeyHex,
      };
      
      console.log(`[DaoMix] Sending ${currentCiphertexts.length} ciphertexts to mix node at ${url}...`);
      const startTime = Date.now();
      
      const { data } = await axios.post<MixResponse>(url, reqBody, {
        timeout: 300_000, // 5 minutes timeout for large batches
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (!Array.isArray(data.ciphertexts)) {
        throw new Error(`Invalid /mix response from ${url}`);
      }
      
      currentCiphertexts = data.ciphertexts;
      console.log(`[DaoMix] ✅ Mixed via ${node.url} in ${elapsed}s, permutationCommitment=${data.permutationCommitment}`);
    }
    
    const finalCiphertextsHex = currentCiphertexts;
    console.log();

    // 12) Compute output Merkle root
    const outputRoot = buildMerkleRoot(finalCiphertextsHex);
    console.log(`[DaoMix] Output Merkle root: ${outputRoot}\n`);

    // 13) Decrypt final ciphertexts and tally votes
    console.log(`🔓 Decrypting and tallying ${finalCiphertextsHex.length} votes...`);
    const tallyKeypair: Keypair = {
      secretKey: fromHex(onionCfg.tallySecretKey),
      publicKey: fromHex(onionCfg.tallyPublicKey),
    };

    const decryptedVotes: string[] = [];
    const counts: Record<string, number> = {};

    for (let i = 0; i < finalCiphertextsHex.length; i++) {
      const cipher = finalCiphertextsHex[i];
      try {
        const plainBytes = await decryptFinalForTally(
          cipher,
          tallyKeypair,
          senderPublicBytes,
        );
        const vote = decoder.decode(plainBytes);
        decryptedVotes.push(vote);
        counts[vote] = (counts[vote] || 0) + 1;
      } catch (err) {
        console.error(`⚠️  Failed to decrypt vote ${i}:`, err);
      }

      if ((i + 1) % 25 === 0 || i + 1 === finalCiphertextsHex.length) {
        console.log(`  ✅ Decrypted ${i + 1}/${finalCiphertextsHex.length} votes...`);
      }
    }

    console.log(`[DaoMix] Decrypted ${decryptedVotes.length} votes`);
    console.log(`[DaoMix] Tally counts:`, counts);
    console.log();

    // 14) Verify vote counts match expected distribution
    console.log(`📊 Verifying vote counts...`);
    const expectedCounts = voteCounts;
    const actualCounts = counts;
    
    let allMatch = true;
    for (const candidate of candidates) {
      const expected = expectedCounts[candidate] || 0;
      const actual = actualCounts[candidate] || 0;
      if (expected !== actual) {
        console.log(`  ⚠️  ${candidate}: expected ${expected}, got ${actual}`);
        allMatch = false;
      } else {
        console.log(`  ✅ ${candidate}: ${actual} votes (matches expected)`);
      }
    }
    
    if (allMatch) {
      console.log(`✅ All vote counts match expected distribution!\n`);
    } else {
      console.log(`⚠️  Some vote counts don't match (this may be due to mixing/decryption issues)\n`);
    }

    // 15) Build result payload and hash
    const resultUri = process.env.DAOMIX_RESULT_URI || `ipfs://daomix-scale-test/${electionId}`;
    const resultPayload = {
      electionId: Number(electionId),
      inputRoot,
      outputRoot,
      ballotCount: ballots.length,
      decryptedVotes,
      counts,
      expectedCounts,
      voterCount,
    };
    const resultHashHex: HexString =
      (`0x${keccak256(Buffer.from(JSON.stringify(resultPayload))).toString("hex")}`) as HexString;

    console.log(`[DaoMix] Result URI: ${resultUri}`);
    console.log(`[DaoMix] Result hash: ${resultHashHex}\n`);

    // 16) Advance time to pass voting deadline
    const election = await contract.elections(electionId);
    const currentBlock = await provider.getBlock("latest");
    if (currentBlock && BigInt(currentBlock.timestamp) < election.votingDeadline) {
      const timeToAdvance = Number(election.votingDeadline - BigInt(currentBlock.timestamp) + BigInt(1));
      console.log(`⏳ Advancing blockchain time by ${timeToAdvance} seconds to pass voting deadline...`);
      try {
        await provider.send("evm_increaseTime", [Number(timeToAdvance)]);
        await provider.send("evm_mine", []);
        console.log(`✅ Time advanced, voting deadline has passed\n`);
      } catch (err) {
        console.log(`⚠️  Could not advance time automatically. Please wait for voting deadline or advance time manually.\n`);
        throw new Error("Voting deadline has not passed. Cannot submit mix commitments.");
      }
    }

    // 17) Commit mix commitments to contract
    console.log(`📝 Submitting mix commitments to contract...`);
    const commitmentTx = await contract.setMixCommitments(electionId, inputRoot, outputRoot);
    await commitmentTx.wait();
    console.log(`✅ Mix commitments submitted, tx: ${commitmentTx.hash}\n`);

    // 18) Submit tally to contract
    console.log(`📝 Submitting tally results to contract...`);
    const tallyWallet = new ethers.Wallet(
      process.env.DAOMIX_TALLY_PRIVATE_KEY || adminPrivateKey,
      provider
    );
    const tallyNonce = await provider.getTransactionCount(tallyWallet.address, "latest");
    const tallyContract = new ethers.Contract(contractAddress, contractABI, tallyWallet);
    const tallyTx = await tallyContract.submitTally(electionId, resultUri, resultHashHex, { nonce: tallyNonce });
    await tallyTx.wait();
    console.log(`✅ Tally submitted, tx: ${tallyTx.hash}\n`);

    // 19) Verify finalization
    const finalElection = await contract.elections(electionId);
    console.log(`🎯 Election finalized: ${finalElection.finalized}`);
    console.log(`🎯 Final tally counts:`, counts);
    console.log(`🎯 Total votes processed: ${decryptedVotes.length}`);
    console.log(`\n✅ DaoMix Scale Test Complete with ${voterCount} Voters!`);

  } catch (err) {
    console.error("❌ DaoMix Scale Test failed:", err);
    process.exit(1);
  }
}

void main();

