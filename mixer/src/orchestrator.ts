import "dotenv/config";
import axios from "axios";
import { ethers } from "ethers";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";

import { MixRequest, MixResponse, HexString } from "./shared";
import {
  loadDaoMixConfig,
  loadOnionConfig,
  loadMixNodes,
  MixNodeConfig,
} from "./config";
import { decryptFinalForTally } from "./onion";
import { fromHex, Keypair } from "./crypto";
import { TextDecoder } from "util";

const DAO_MIX_VOTING_ABI = [
  "function getBallots(uint256 electionId) view returns (bytes[] memory)",
  "function setMixCommitments(uint256 electionId, bytes32 inputRoot, bytes32 outputRoot) external",
  "function submitTally(uint256 electionId, string resultUri, bytes32 resultHash) external",
  "function elections(uint256 electionId) view returns (uint256 id, string name, uint256 registrationDeadline, uint256 votingDeadline, address admin, address tallyAuthority, bytes32 commitmentInputRoot, bytes32 commitmentOutputRoot, bool finalized)"
];

export function buildMerkleRoot(values: HexString[]): HexString {
  if (values.length === 0) {
    return `0x${"00".repeat(32)}`;
  }

  const leaves = values.map((hex) => {
    const raw = Buffer.from(hex.replace(/^0x/, ""), "hex");
    return keccak256(raw);
  });

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot();
  return `0x${root.toString("hex")}`;
}

function getProviderAndContract() {
  const { rpcUrl, contractAddress, adminPrivateKey } = loadDaoMixConfig();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(adminPrivateKey, provider);
  const contract = new ethers.Contract(
    contractAddress,
    DAO_MIX_VOTING_ABI,
    wallet
  );

  return { provider, wallet, contract };
}

async function runMixChain(
  ciphertexts: HexString[],
  senderPublicKey: HexString,
  mixNodes: MixNodeConfig[]
): Promise<HexString[]> {
  if (mixNodes.length === 0) {
    throw new Error("No mix-nodes configured");
  }

  let current = ciphertexts;

  for (const node of mixNodes) {
    const reqBody: MixRequest = {
      ciphertexts: current,
      senderPublicKey,
    };

    const { data } = await axios.post<MixResponse>(`${node.url}/mix`, reqBody, {
      timeout: 30_000,
    });

    if (!data || !Array.isArray(data.ciphertexts)) {
      throw new Error(`Invalid response from mix-node at ${node.url}`);
    }

    current = data.ciphertexts;
    console.log(
      `[DaoMix] Mixed via ${node.url}, permutationCommitment=${data.permutationCommitment}`
    );
  }

  return current;
}

export async function runDaoMixForElection(electionId: number): Promise<void> {
  const { contract } = getProviderAndContract();
  const onionCfg = loadOnionConfig();
  const mixNodes = loadMixNodes();

  const senderPublicKeyHex = onionCfg.senderPublicKey;
  const senderPublicBytes = fromHex(senderPublicKeyHex);

  const tallyKeypair: Keypair = {
    secretKey: fromHex(onionCfg.tallySecretKey),
    publicKey: fromHex(onionCfg.tallyPublicKey),
  };
  const decoder = new TextDecoder();

  console.log(`[DaoMix] Fetching ballots for election ${electionId}...`);
  const ballots: HexString[] = await contract.getBallots(electionId);
  if (!ballots || ballots.length === 0) {
    throw new Error("No ballots found for this election");
  }

  console.log(`[DaoMix] Found ${ballots.length} ballots.`);
  const inputRoot = buildMerkleRoot(ballots);
  console.log("[DaoMix] Input root:", inputRoot);

  console.log("[DaoMix] Sending through mix-nodes chain...");
  const finalCiphertexts = await runMixChain(
    ballots,
    senderPublicKeyHex,
    mixNodes
  );

  const outputRoot = buildMerkleRoot(finalCiphertexts);
  console.log("[DaoMix] Output root:", outputRoot);

  const decryptedVotes: string[] = [];
  const counts: Record<string, number> = {};

  for (const cipher of finalCiphertexts) {
    const plainBytes = await decryptFinalForTally(
      cipher,
      tallyKeypair,
      senderPublicBytes
    );
    const vote = decoder.decode(plainBytes);
    decryptedVotes.push(vote);
    counts[vote] = (counts[vote] || 0) + 1;
  }

  console.log("[DaoMix] Decrypted votes:", decryptedVotes);
  console.log("[DaoMix] Tally counts:", counts);

  const resultUri =
    process.env.DAOMIX_RESULT_URI || `ipfs://daomix-demo/${electionId}`;
  const resultPayload = {
    electionId,
    inputRoot,
    outputRoot,
    ballotCount: ballots.length,
    decryptedVotes,
    counts,
  };
  const resultHash =
    "0x" + keccak256(Buffer.from(JSON.stringify(resultPayload))).toString("hex");

  console.log("[DaoMix] Result URI:", resultUri);
  console.log("[DaoMix] Result hash:", resultHash);

  console.log("[DaoMix] Sending setMixCommitments...");
  const tx1 = await contract.setMixCommitments(
    electionId,
    inputRoot,
    outputRoot
  );
  await tx1.wait();
  console.log("[DaoMix] setMixCommitments confirmed:", tx1.hash);

  console.log("[DaoMix] Sending submitTally...");
  const tx2 = await contract.submitTally(electionId, resultUri, resultHash);
  await tx2.wait();
  console.log("[DaoMix] submitTally confirmed:", tx2.hash);

  console.log("[DaoMix] Election finalized on-chain.");
}

