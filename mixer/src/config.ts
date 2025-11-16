import "dotenv/config";
import { HexString } from "./shared";
import axios from "axios";

export interface MixNodeConfig {
  url: string;
  publicKey: HexString;
  pqPublicKey?: Uint8Array; // Optional ML-KEM public key
}

export interface DaoMixConfig {
  rpcUrl: string;
  contractAddress: string;
  adminPrivateKey: string;
}

export interface OnionConfig {
  tallyPublicKey: HexString;
  tallySecretKey: HexString;
  senderSecretKey: HexString;
  senderPublicKey: HexString;
}

export function loadDaoMixConfig(): DaoMixConfig {
  const rpcUrl = process.env.DAOMIX_RPC_URL || "http://127.0.0.1:8545";
  const contractAddress = process.env.DAOMIX_CONTRACT_ADDRESS;
  const adminPrivateKey = process.env.DAOMIX_ADMIN_PRIVATE_KEY;

  if (!contractAddress) {
    throw new Error("DAOMIX_CONTRACT_ADDRESS is not set");
  }
  if (!adminPrivateKey) {
    throw new Error("DAOMIX_ADMIN_PRIVATE_KEY is not set");
  }

  return { rpcUrl, contractAddress, adminPrivateKey };
}

export function loadOnionConfig(): OnionConfig {
  const tallyPublicKey = process.env.DAOMIX_TALLY_PUBLIC_KEY as HexString;
  const tallySecretKey = process.env.DAOMIX_TALLY_SECRET_KEY as HexString;
  const senderSecretKey = process.env.DAOMIX_SENDER_SECRET_KEY as HexString;
  const senderPublicKey = process.env.DAOMIX_SENDER_PUBLIC_KEY as HexString;

  if (!tallyPublicKey) {
    throw new Error("DAOMIX_TALLY_PUBLIC_KEY is not set");
  }
  if (!tallySecretKey) {
    throw new Error("DAOMIX_TALLY_SECRET_KEY is not set");
  }
  if (!senderSecretKey) {
    throw new Error("DAOMIX_SENDER_SECRET_KEY is not set");
  }
  if (!senderPublicKey) {
    throw new Error("DAOMIX_SENDER_PUBLIC_KEY is not set");
  }

  return { tallyPublicKey, tallySecretKey, senderSecretKey, senderPublicKey };
}

export async function loadMixNodes(): Promise<MixNodeConfig[]> {
  const urlsEnv = process.env.MIX_NODE_URLS;

  if (!urlsEnv) {
    throw new Error("MIX_NODE_URLS is not set");
  }

  const urls = urlsEnv.split(",").map((u) => u.trim()).filter(Boolean);

  // Autodiscover X25519 public keys from /health for each mix node
  const nodes: MixNodeConfig[] = [];
  for (const url of urls) {
    const base = url.replace(/\/+$/, "");
    const healthUrl = `${base}/health`;
    try {
      const { data } = await axios.get(healthUrl, { timeout: 5000 });
      const nodePublicKey = (data?.nodePublicKey || data?.publicKey) as string | undefined;
      if (!nodePublicKey || typeof nodePublicKey !== "string") {
        throw new Error(`Invalid /health response, missing nodePublicKey at ${url}`);
      }
      nodes.push({
        url: base,
        publicKey: nodePublicKey as HexString,
      });
    } catch (err) {
      throw new Error(`Failed to fetch mix-node /health from ${url}: ${String((err as any)?.message || err)}`);
    }
  }

  // Optional PQ public keys
  const pqPubKeysEnv = process.env.MIX_NODE_PQ_PUBLIC_KEYS;
  let pqPubKeys: (Uint8Array | undefined)[] = [];

  if (pqPubKeysEnv && isPqEnabled()) {
    const pqHexStrings = pqPubKeysEnv
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (pqHexStrings.length !== urls.length) {
      console.warn(
        `MIX_NODE_PQ_PUBLIC_KEYS length (${pqHexStrings.length}) does not match MIX_NODE_URLS (${urls.length}). PQ will be disabled for nodes without PQ keys.`,
      );
    }

    pqPubKeys = pqHexStrings.map((hex) => {
      if (!hex) return undefined;
      // Remove 0x prefix if present
      const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
      return new Uint8Array(Buffer.from(normalized, "hex"));
    });

    // Pad to match urls length if needed
    while (pqPubKeys.length < urls.length) {
      pqPubKeys.push(undefined);
    }
  }

  // Attach optional PQ keys by index if provided
  if (pqPubKeys.length > 0) {
    for (let i = 0; i < nodes.length && i < pqPubKeys.length; i++) {
      nodes[i].pqPublicKey = pqPubKeys[i];
    }
  }

  return nodes;
}

export interface ShardingConfig {
  enableSharding: boolean;
  shardCount: number; // shards per ciphertext
  bundleSize: number; // shards per bundle
}

/**
 * Check if post-quantum / hybrid mode is enabled.
 */
export function isPqEnabled(): boolean {
  return process.env.DAOMIX_PQ_ENABLED === "true";
}

export function loadShardingConfig(): ShardingConfig {
  const enable =
    process.env.DAOMIX_ENABLE_SHARDING === "true" ||
    process.env.DAOMIX_ENABLE_SHARDING === "1";

  const shardCount = (() => {
    const raw = process.env.DAOMIX_SHARD_COUNT;
    const n = raw ? parseInt(raw, 10) : 3;
    return Number.isFinite(n) && n > 0 ? n : 3;
  })();

  const bundleSize = (() => {
    const raw = process.env.DAOMIX_BUNDLE_SIZE;
    const n = raw ? parseInt(raw, 10) : 4;
    return Number.isFinite(n) && n > 0 ? n : 4;
  })();

  return {
    enableSharding: enable,
    shardCount,
    bundleSize,
  };
}

