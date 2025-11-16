import express from "express";
import dotenv from "dotenv";
import keccak256 from "keccak256";
import {
  initCrypto,
  generateKeypair,
  Keypair,
  toHex,
  fromHex,
  decryptLayer,
  publicKeyFromSecret,
} from "../src/crypto/crypto";
import { MixRequest, MixResponse, HexString } from "../src/types/shared";

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

      for (const outerHex of body.ciphertexts) {
        const innerBytes = decryptLayer(
          nodeKeypair.secretKey,
          senderPubBytes,
          outerHex,
        );
        innerCiphertexts.push(toHex(innerBytes));
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

