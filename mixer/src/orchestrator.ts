import "dotenv/config";
import axios from "axios";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";
import type { ApiPromise } from "@polkadot/api";

import { MixRequest, MixResponse, HexString } from "./shared";
import {
  loadOnionConfig,
  loadMixNodes,
  MixNodeConfig,
  loadShardingConfig,
} from "./config";
import { decryptFinalForTally } from "./onion";
import { fromHex, toHex, Keypair } from "./crypto";
import { connectDaoChain, setMixCommitmentsTx, submitTallyTx } from "./substrateClient";
import { TextDecoder, TextEncoder } from "util";
import {
  shardCiphertext,
  createBundles,
  Shard,
  ShardBundle,
} from "./sharding";

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

/**
 * Convert a Merkle root HexString to Uint8Array for Substrate.
 */
function merkleRootToBytes(rootHex: HexString): Uint8Array {
  const cleanHex = rootHex.replace(/^0x/, "");
  return Buffer.from(cleanHex, "hex");
}

/**
 * Fetch all ballots for an election from DaoChain storage.
 */
async function fetchBallotsFromDaoChain(
  api: ApiPromise,
  electionId: number,
): Promise<Uint8Array[]> {
  // Read ballot count (ValueQuery returns u32 directly)
  const countOpt = await api.query.daomixVoting.ballotCount(electionId);
  const count = (countOpt as any).toNumber ? (countOpt as any).toNumber() : Number(countOpt);

  const ballots: Uint8Array[] = [];

  // Fetch each ballot (StorageDoubleMap returns Option<BoundedVec<u8>>)
  for (let index = 0; index < count; index++) {
    const storage = await api.query.daomixVoting.ballots(electionId, index);
    
    // Check if Option is None
    if (!storage || (storage as any).isNone === true || (storage as any).isEmpty === true) {
      // Skip missing ballots (shouldn't happen, but handle gracefully)
      continue;
    }

    // Unwrap Option and convert BoundedVec<u8> to Uint8Array
    const bytes = (storage as any).unwrap ? (storage as any).unwrap() : storage;
    ballots.push((bytes as any).toU8a ? (bytes as any).toU8a() : new Uint8Array(bytes as any));
  }

  return ballots;
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

/**
 * Run the DaoMix mixing pipeline for an election on DaoChain.
 * 
 * This function:
 * 1. Fetches ballots from DaoChain storage
 * 2. Sends them through the mix-node chain
 * 3. Computes input/output Merkle roots
 * 4. Decrypts and tallies votes
 * 5. Commits mix commitments and tally results to DaoChain
 */
export async function runDaoMixForElectionOnDaoChain(
  electionId: number,
): Promise<void> {
  // 1) Connect to DaoChain
  const clients = await connectDaoChain();
  const { api, tally } = clients;

  try {
    // 2) Load config for onion/mix operations
    const onionCfg = loadOnionConfig();
    const mixNodes = loadMixNodes();

    const senderPublicKeyHex = onionCfg.senderPublicKey;
    const senderPublicBytes = fromHex(senderPublicKeyHex);

    const tallyKeypair: Keypair = {
      secretKey: fromHex(onionCfg.tallySecretKey),
      publicKey: fromHex(onionCfg.tallyPublicKey),
    };
    const decoder = new TextDecoder();

    // 3) Fetch ballots from DaoChain
    console.log(`[DaoChain] Fetching ballots for election ${electionId}...`);
    const ballotsBytes = await fetchBallotsFromDaoChain(api, electionId);

    if (ballotsBytes.length === 0) {
      console.log(`⚠️ No ballots found for election ${electionId}`);
      return;
    }

    console.log(`[DaoChain] Found ${ballotsBytes.length} ballots.`);

    // 4) Convert ballots to HexString[] for mix chain processing
    const ballotsHex: HexString[] = ballotsBytes.map((bytes) => toHex(bytes));

    // 4a) Load sharding config and compute metrics if enabled
    const shardingConfig = loadShardingConfig();

    let shardingMetrics: any = null;

    if (shardingConfig.enableSharding && ballotsHex.length > 0) {
      const { shardCount, bundleSize } = shardingConfig;

      // 1) Shard every ciphertext
      const allShards: Shard[] = [];
      ballotsHex.forEach((hex, idx) => {
        const shardsForCipher = shardCiphertext(hex, shardCount);
        // Keep shardIndex as produced by shardCiphertext (local order).
        // We don't need ballot index for metrics-only usage.
        allShards.push(...shardsForCipher);
      });

      // 2) Bundle shards
      const bundles: ShardBundle[] = createBundles(allShards, bundleSize);

      // 3) Compute some real metrics
      const bundleSizes = bundles.map((b) => b.shards.length);
      const totalShards = allShards.length;
      const bundleCount = bundles.length;
      const minBundleSize = bundleSizes.length ? Math.min(...bundleSizes) : 0;
      const maxBundleSize = bundleSizes.length ? Math.max(...bundleSizes) : 0;
      const avgBundleSize =
        bundleSizes.length && totalShards > 0
          ? totalShards / bundleSizes.length
          : 0;

      // 4) Record shard-level commitments (bundle IDs + roots)
      const bundleSummaries = bundles.map((b) => ({
        bundleId: b.bundleId,
        bundleCommitment: b.bundleCommitment,
        shardCount: b.shards.length,
      }));

      shardingMetrics = {
        enabled: true,
        shardCount,
        bundleSize,
        totalCiphertexts: ballotsHex.length,
        totalShards,
        bundleCount,
        minBundleSize,
        maxBundleSize,
        avgBundleSize,
        bundles: bundleSummaries,
      };

      console.log("[DaoMix] Sharding metrics:", JSON.stringify(shardingMetrics));
    } else {
      shardingMetrics = {
        enabled: false,
        reason:
          ballotsHex.length === 0
            ? "no ciphertexts for election"
            : "DAOMIX_ENABLE_SHARDING not set",
      };
    }

    // 5) Compute input Merkle root
    const inputRoot = buildMerkleRoot(ballotsHex);
    console.log("[DaoChain] Input root:", inputRoot);

    // 6) Send ballots through mix-node chain
    console.log("[DaoChain] Sending through mix-nodes chain...");
    const finalCiphertextsHex = await runMixChain(
      ballotsHex,
      senderPublicKeyHex,
      mixNodes,
    );

    // 7) Compute output Merkle root
    const outputRoot = buildMerkleRoot(finalCiphertextsHex);
    console.log("[DaoChain] Output root:", outputRoot);

    // 8) Decrypt final ciphertexts and tally votes
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

    console.log("[DaoChain] Decrypted votes:", decryptedVotes);
    console.log("[DaoChain] Tally counts:", counts);

    // 9) Build result payload and hash
    const resultUri =
      process.env.DAOMIX_RESULT_URI || `ipfs://daomix-demo/${electionId}`;
    const resultPayload = {
      electionId,
      inputRoot,
      outputRoot,
      ballotCount: ballotsBytes.length,
      decryptedVotes,
      counts,
      sharding: shardingMetrics,
    };
    const resultHashHex: HexString =
      ("0x" +
        keccak256(Buffer.from(JSON.stringify(resultPayload))).toString(
          "hex",
        )) as HexString;

    console.log("[DaoChain] Result URI:", resultUri);
    console.log("[DaoChain] Result hash:", resultHashHex);

    // 10) Convert Merkle roots to Uint8Array for Substrate
    const inputRootBytes = merkleRootToBytes(inputRoot);
    const outputRootBytes = merkleRootToBytes(outputRoot);
    const resultHashBytes = merkleRootToBytes(resultHashHex);

    // 11) Commit mix commitments to DaoChain
    console.log("[DaoChain] Sending setMixCommitments...");
    const commitmentHash = await setMixCommitmentsTx(
      clients,
      electionId,
      inputRootBytes,
      outputRootBytes,
    );
    console.log("[DaoChain] setMixCommitments submitted, hash:", commitmentHash);

    // 12) Submit tally to DaoChain
    console.log("[DaoChain] Sending submitTally...");
    const resultUriBytes = new TextEncoder().encode(resultUri);
    const tallyHash = await submitTallyTx(
      clients,
      electionId,
      resultUriBytes,
      resultHashBytes,
    );
    console.log("[DaoChain] submitTally submitted, hash:", tallyHash);

    console.log("[DaoChain] Election finalized on-chain.");
  } finally {
    await api.disconnect();
  }
}

/**
 * @deprecated Use runDaoMixForElectionOnDaoChain instead.
 * This function is kept for backward compatibility with existing demo scripts.
 */
export async function runDaoMixForElection(electionId: number): Promise<void> {
  await runDaoMixForElectionOnDaoChain(electionId);
}

