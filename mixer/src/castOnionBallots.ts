import "dotenv/config";
import { ethers } from "ethers";
import { TextEncoder } from "util";
import { buildOnion } from "./onion";
import {
  initCrypto,
  fromHex,
  Keypair,
} from "./crypto";
import {
  loadDaoMixConfig,
  loadMixNodes,
  loadOnionConfig,
} from "./config";

const DAO_MIX_VOTING_ABI = [
  "function castVote(uint256 electionId, bytes ballotCipher) external",
  "function registerVoter(uint256 electionId, address voter) external",
  "function elections(uint256 electionId) view returns (uint256 id, string name, uint256 registrationDeadline, uint256 votingDeadline, address admin, address tallyAuthority, bytes32 commitmentInputRoot, bytes32 commitmentOutputRoot, bool finalized)",
];

function getVotingContract() {
  const { rpcUrl, contractAddress, adminPrivateKey } = loadDaoMixConfig();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(adminPrivateKey, provider);
  const contract = new ethers.Contract(contractAddress, DAO_MIX_VOTING_ABI, wallet);
  return { provider, wallet, contract };
}

const encoder = new TextEncoder();

export async function castDemoOnionBallots(
  electionId: number,
): Promise<void> {
  await initCrypto();

  const { contract, wallet } = getVotingContract();
  const onionCfg = loadOnionConfig();
  const mixNodes = loadMixNodes();

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

  const votes = ["ALICE", "BOB", "ALICE"];

  console.log(`[DaoMix] Casting ${votes.length} onion-encrypted ballots...`);

  for (const vote of votes) {
    const voteBytes = encoder.encode(vote);
    const onionHex = await buildOnion({
      vote: voteBytes,
      mixNodes: mixNodePublics,
      tally: { publicKey: tallyPublicBytes },
      senderKeypair,
    });

    const tx = await contract.castVote(electionId, onionHex);
    await tx.wait();
    console.log(`[DaoMix] castVote for "${vote}" tx=${tx.hash}`);
  }

  console.log("[DaoMix] All demo ballots cast.");
  console.log("[DaoMix] Voter (msg.sender):", await wallet.getAddress());
}

