import express from "express";
import dotenv from "dotenv";
import keccak256 from "keccak256";
import {
  initCrypto,
  generateKeypair,
  Keypair,
  toHex,
  fromHex,
  publicKeyFromSecret,
} from "./crypto";
import { peelOnionForNode } from "./onion";
import { MixRequest, MixResponse, HexString } from "./shared";

dotenv.config();

let nodeKeypair: Keypair;
let nodePublicKeyHex: string;

async function main() {
  await initCrypto();

  const secretHex = process.env.MIX_NODE_SECRET_KEY as HexString | undefined;
  if (secretHex) {
    const secretKey = fromHex(secretHex);
    const publicKey = await publicKeyFromSecret(secretKey);
    nodeKeypair = {
      publicKey,
      secretKey,
    };
  } else {
    nodeKeypair = generateKeypair();
  }
  nodePublicKeyHex = toHex(nodeKeypair.publicKey);

  console.log("[DaoMix] Mix-node starting...");
  console.log("[DaoMix] Public key:", nodePublicKeyHex);

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      nodePublicKey: nodePublicKeyHex,
    });
  });

  app.post("/mix", async (req, res) => {
    try {
      const body = req.body as MixRequest;

      if (
        !body ||
        !Array.isArray(body.ciphertexts) ||
        body.ciphertexts.length === 0
      ) {
        return res.status(400).json({ error: "Invalid or empty ciphertexts" });
      }
      if (!body.senderPublicKey || typeof body.senderPublicKey !== "string") {
        return res.status(400).json({ error: "Missing senderPublicKey" });
      }

      const senderPubBytes = fromHex(body.senderPublicKey);
      const innerCiphertexts: HexString[] = [];

      console.log(`[DaoMix] /mix: Peeling ${body.ciphertexts.length} ciphertexts`);
      console.log(`[DaoMix] /mix: Node public key: ${nodePublicKeyHex}`);
      console.log(`[DaoMix] /mix: Sender public key: ${body.senderPublicKey}`);
      console.log(`[DaoMix] /mix: First ciphertext (truncated): ${body.ciphertexts[0]?.substring(0, 100)}...`);

      for (let idx = 0; idx < body.ciphertexts.length; idx++) {
        const outerHex = body.ciphertexts[idx];
        try {
          // Use hybrid peeling (supports both classical and PQ)
          const innerHex = await peelOnionForNode(
            outerHex,
            nodeKeypair,
            senderPubBytes,
            undefined, // No PQ secret key for classical mode
          );
          innerCiphertexts.push(innerHex);
        } catch (err) {
          console.error(`[DaoMix] /mix: Failed to peel ciphertext ${idx}:`, err);
          throw err;
        }
      }

      const permutation: number[] = [];
      for (let i = 0; i < innerCiphertexts.length; i++) {
        permutation.push(i);
      }

      for (let i = permutation.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
      }

      const permuted: HexString[] = permutation.map(
        (idx) => innerCiphertexts[idx],
      );

      const permBuf = Buffer.from(JSON.stringify(permutation), "utf8");
      const hashHex =
        "0x" + keccak256(permBuf).toString("hex");
      const permutationCommitment = hashHex as HexString;

      const response: MixResponse = {
        ciphertexts: permuted,
        permutation,
        permutationCommitment,
      };

      return res.json(response);
    } catch (err) {
      console.error("[DaoMix] /mix error:", err);
      return res.status(500).json({ error: "Mix-node internal error" });
    }
  });

  const port = Number(process.env.MIX_NODE_PORT || 4001);

  app.listen(port, () => {
    console.log(`[DaoMix] Mix-node listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("[DaoMix] Mix-node error:", err);
  process.exit(1);
});

