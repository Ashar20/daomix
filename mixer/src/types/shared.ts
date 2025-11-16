export type HexString = `0x${string}`;

export interface MixRequest {
  ciphertexts: HexString[];
  senderPublicKey: HexString;
}

export interface MixResponse {
  ciphertexts: HexString[];
  permutation: number[];
  permutationCommitment: HexString;
}

