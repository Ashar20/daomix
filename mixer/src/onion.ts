import {
  Keypair,
  HexString,
  encryptLayer,
  decryptLayer,
  fromHex,
  toHex,
  initCrypto,
} from "./crypto";

export interface NodePublic {
  publicKey: Uint8Array;
}

export interface OnionBuildParams {
  vote: Uint8Array;
  mixNodes: NodePublic[];
  tally: NodePublic;
  senderKeypair: Keypair;
}

export async function buildOnion(
  params: OnionBuildParams,
): Promise<HexString> {
  await initCrypto();

  let currentHex = encryptLayer(
    params.tally.publicKey,
    params.senderKeypair.secretKey,
    params.vote,
  );

  for (let i = params.mixNodes.length - 1; i >= 0; i--) {
    const asBytes = fromHex(currentHex);
    currentHex = encryptLayer(
      params.mixNodes[i].publicKey,
      params.senderKeypair.secretKey,
      asBytes,
    );
  }

  return currentHex;
}

export async function peelOnionForNode(
  layersHex: HexString,
  nodeKeypair: Keypair,
  senderPublicKey: Uint8Array,
): Promise<HexString> {
  await initCrypto();

  const inner = decryptLayer(
    nodeKeypair.secretKey,
    senderPublicKey,
    layersHex,
  );

  return toHex(inner);
}

export async function decryptFinalForTally(
  finalHex: HexString,
  tallyKeypair: Keypair,
  senderPublicKey: Uint8Array,
): Promise<Uint8Array> {
  await initCrypto();

  return decryptLayer(
    tallyKeypair.secretKey,
    senderPublicKey,
    finalHex,
  );
}

