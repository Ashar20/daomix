import sodium from "libsodium-wrappers";

export interface Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export type HexString = `0x${string}`;

let sodiumReady = false;

export async function initCrypto(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

export function generateKeypair(): Keypair {
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: new Uint8Array(kp.publicKey),
    secretKey: new Uint8Array(kp.privateKey),
  };
}

export function toHex(bytes: Uint8Array): HexString {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function fromHex(hex: HexString): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(normalized, "hex"));
}

export async function publicKeyFromSecret(
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  await initCrypto();
  return sodium.crypto_scalarmult_base(secretKey);
}

function deriveKey(shared: Uint8Array): Uint8Array {
  const context = sodium.from_string("DaoMix-layer");
  return sodium.crypto_generichash(32, shared, context);
}

export function encryptLayer(
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array,
  inner: Uint8Array,
): HexString {
  const shared = sodium.crypto_scalarmult(senderSecretKey, recipientPublicKey);
  const key = deriveKey(shared);

  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    inner,
    null,
    null,
    nonce,
    key,
  );

  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return toHex(combined);
}

export function decryptLayer(
  recipientSecretKey: Uint8Array,
  senderPublicKey: Uint8Array,
  outerHex: HexString,
): Uint8Array {
  const outer = fromHex(outerHex);
  const nonceBytes =
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;

  if (outer.length < nonceBytes) {
    throw new Error("DaoMix: ciphertext too short");
  }

  const nonce = outer.slice(0, nonceBytes);
  const ciphertext = outer.slice(nonceBytes);

  const shared = sodium.crypto_scalarmult(recipientSecretKey, senderPublicKey);
  const key = deriveKey(shared);

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      key,
    );
  } catch (err) {
    throw new Error("DaoMix: failed to decrypt layer");
  }
}

