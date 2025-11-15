import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import {
	initCrypto,
	generateKeypair,
	Keypair,
	toHex,
	fromHex,
	publicKeyFromSecret,
} from "./crypto";
import {
	peelTransportLayer,
	decodeRpcPayload,
} from "./transportOnion";
import { HexString } from "./shared";

dotenv.config();

let nodeKeypair: Keypair;
let nodePublicKeyHex: string;
let role: "entry" | "middle" | "exit";
let nextHop: string | null = null;
let rpcUrl: string | null = null;

async function main() {
	await initCrypto();

	// Derive the node keypair
	const secretHex = process.env.TRANSPORT_SECRET_KEY as HexString | undefined;
	if (secretHex) {
		const secretKey = fromHex(secretHex);
		const publicKey = await publicKeyFromSecret(secretKey);
		nodeKeypair = {
			publicKey,
			secretKey,
		};
	} else {
		nodeKeypair = generateKeypair();
		console.log(
			"[TransportNode] Generated keypair (for local dev):",
		);
		console.log(
			`[TransportNode] Secret key: ${toHex(nodeKeypair.secretKey)}`,
		);
		console.log(
			`[TransportNode] Public key: ${toHex(nodeKeypair.publicKey)}`,
		);
	}
	nodePublicKeyHex = toHex(nodeKeypair.publicKey);

	// Read required env vars
	const roleEnv = process.env.TRANSPORT_ROLE;
	if (!roleEnv || !["entry", "middle", "exit"].includes(roleEnv)) {
		throw new Error(
			'TRANSPORT_ROLE must be one of: "entry", "middle", "exit"',
		);
	}
	role = roleEnv as "entry" | "middle" | "exit";

	if (role === "entry" || role === "middle") {
		nextHop = process.env.TRANSPORT_NEXT_HOP || null;
		if (!nextHop) {
			throw new Error(
				`TRANSPORT_NEXT_HOP is required for ${role} nodes`,
			);
		}
	}

	if (role === "exit") {
		rpcUrl = process.env.TRANSPORT_RPC_URL || null;
	}

	const port = Number(process.env.TRANSPORT_PORT || 9100);

	console.log("[TransportNode] Starting...");
	console.log(`[TransportNode] Role: ${role}`);
	console.log(`[TransportNode] Public key: ${nodePublicKeyHex}`);
	console.log(`[TransportNode] Port: ${port}`);
	console.log(`[TransportNode] Next hop: ${nextHop || "N/A"}`);
	console.log(`[TransportNode] RPC URL: ${rpcUrl || "N/A"}`);

	const app = express();
	app.use(express.json());

	app.get("/health", (_req, res) => {
		res.json({
			status: "ok",
			role,
			publicKey: nodePublicKeyHex,
			nextHop,
			rpcUrl,
		});
	});

	app.post("/rpc-mix", async (req, res) => {
		try {
			const body = req.body as {
				ciphertext: HexString;
				senderPublicKey: HexString;
			};

			if (!body || typeof body.ciphertext !== "string") {
				return res.status(400).json({ error: "Invalid ciphertext" });
			}
			if (
				!body.senderPublicKey ||
				typeof body.senderPublicKey !== "string"
			) {
				return res.status(400).json({ error: "Missing senderPublicKey" });
			}

			const senderPubBytes = fromHex(body.senderPublicKey);

			// Peel one layer
			const peeledBytes = await peelTransportLayer({
				ciphertext: body.ciphertext,
				nodeSecretKey: nodeKeypair.secretKey,
				senderPublicKey: senderPubBytes,
			});

			// Branch by role
			if (role === "entry" || role === "middle") {
				// The peeled payload is still onion ciphertext for the next hop
				const innerHex = toHex(peeledBytes) as HexString;

				// Forward to next hop
				const nextHopUrl = nextHop!.endsWith("/rpc-mix")
					? nextHop!
					: `${nextHop!}/rpc-mix`;

				const forwardResponse = await axios.post(
					nextHopUrl,
					{
						ciphertext: innerHex,
						senderPublicKey: body.senderPublicKey,
					},
					{
						timeout: 60_000,
					},
				);

				// Return the exact JSON received from next hop
				return res.json(forwardResponse.data);
			} else {
				// Exit node: peeled payload is the final inner payload
				const { rpcUrl: targetRpcUrl, body: rpcBody } =
					decodeRpcPayload(peeledBytes);

				// Determine final RPC URL
				const finalRpcUrl = targetRpcUrl || rpcUrl;
				if (!finalRpcUrl) {
					console.error(
						"[TransportNode] Exit node: no RPC URL specified in payload or env",
					);
					return res
						.status(500)
						.json({ error: "Transport node internal error" });
				}

				// Forward to actual RPC endpoint
				const rpcResponse = await axios.post(
					finalRpcUrl,
					rpcBody,
					{
						timeout: 60_000,
						headers: {
							"Content-Type": "application/json",
						},
					},
				);

				// Return JSON-RPC response as-is
				return res.json(rpcResponse.data);
			}
		} catch (err) {
			console.error(`[TransportNode] ${role} node /rpc-mix error:`, err);
			return res.status(500).json({ error: "Transport node internal error" });
		}
	});

	app.listen(port, () => {
		console.log(
			`[TransportNode] ${role} node listening on http://localhost:${port}`,
		);
	});
}

main().catch((err) => {
	console.error("[TransportNode] Server error:", err);
	process.exit(1);
});

