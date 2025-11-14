import "dotenv/config";
import axios from "axios";
import { ethers } from "ethers";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";

import { MixRequest, MixResponse, HexString } from "./shared";

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
  const rpcUrl = process.env.DAOMIX_RPC_URL || "http://127.0.0.1:8545";
  const contractAddress = process.env.DAOMIX_CONTRACT_ADDRESS;
  const adminPrivKey = process.env.DAOMIX_ADMIN_PRIVATE_KEY;

  if (!contractAddress) {
    throw new Error("DAOMIX_CONTRACT_ADDRESS is not set");
  }

  if (!adminPrivKey) {
    throw new Error("DAOMIX_ADMIN_PRIVATE_KEY is not set");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(adminPrivKey, provider);
  const contract = new ethers.Contract(
    contractAddress,
    DAO_MIX_VOTING_ABI,
    wallet
  );

  return { provider, wallet, contract };
}

async function runMixChain(ciphertexts: HexString[]): Promise<HexString[]> {
  const urlsEnv = process.env.MIX_NODE_URLS;
  if (!urlsEnv) {
    throw new Error("MIX_NODE_URLS is not set");
  }

  const urls = urlsEnv.split(",").map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) {
    throw new Error("MIX_NODE_URLS is empty");
  }

  const senderPublicKey =
    (process.env.DAOMIX_SENDER_PUBLIC_KEY as HexString) || "0x";

  let current = ciphertexts;

  for (const url of urls) {
    const reqBody: MixRequest = {
      ciphertexts: current,
      senderPublicKey,
    };

    const { data } = await axios.post<MixResponse>(`${url}/mix`, reqBody, {
      timeout: 30_000,
    });

    if (!data || !Array.isArray(data.ciphertexts)) {
      throw new Error(`Invalid response from mix-node at ${url}`);
    }

    current = data.ciphertexts;
    console.log(
      `[DaoMix] Mixed via ${url}, permutationCommitment=${data.permutationCommitment}`
    );
  }

  return current;
}

export async function runDaoMixForElection(electionId: number): Promise<void> {
  const { contract } = getProviderAndContract();

  console.log(`[DaoMix] Fetching ballots for election ${electionId}...`);
  const ballots: HexString[] = await contract.getBallots(electionId);
  if (!ballots || ballots.length === 0) {
    throw new Error("No ballots found for this election");
  }

  console.log(`[DaoMix] Found ${ballots.length} ballots.`);
  const inputRoot = buildMerkleRoot(ballots);
  console.log("[DaoMix] Input root:", inputRoot);

  console.log("[DaoMix] Sending through mix-nodes chain...");
  const finalCiphertexts = await runMixChain(ballots);

  const outputRoot = buildMerkleRoot(finalCiphertexts);
  console.log("[DaoMix] Output root:", outputRoot);

  const resultUri =
    process.env.DAOMIX_RESULT_URI || `ipfs://daomix-demo/${electionId}`;
  const resultPayload = {
    electionId,
    inputRoot,
    outputRoot,
    ballotCount: ballots.length,
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

