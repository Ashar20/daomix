import "dotenv/config";
import { HexString } from "./shared";

export interface MixNodeConfig {
  url: string;
  publicKey: HexString;
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

export function loadMixNodes(): MixNodeConfig[] {
  const urlsEnv = process.env.MIX_NODE_URLS;
  const pubKeysEnv = process.env.MIX_NODE_PUBLIC_KEYS;

  if (!urlsEnv) {
    throw new Error("MIX_NODE_URLS is not set");
  }
  if (!pubKeysEnv) {
    throw new Error("MIX_NODE_PUBLIC_KEYS is not set");
  }

  const urls = urlsEnv.split(",").map((u) => u.trim()).filter(Boolean);
  const pubKeys = pubKeysEnv.split(",").map((p) => p.trim()).filter(Boolean);

  if (urls.length !== pubKeys.length) {
    throw new Error("MIX_NODE_URLS and MIX_NODE_PUBLIC_KEYS length mismatch");
  }

  return urls.map((url, index) => ({
    url,
    publicKey: pubKeys[index] as HexString,
  }));
}

