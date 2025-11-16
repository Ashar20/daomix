import axios from "axios";
import { initCrypto, generateKeypair, toHex } from "../src/crypto/crypto";
import { sendRpcOverTransportMix } from "../src/substrate/transportClient";
import type { TransportNodePub } from "../src/onion/transportOnion";

interface HealthResponse {
	status: string;
	role: string;
	publicKey: string;
	nextHop: string | null;
	rpcUrl: string | null;
}

async function fetchNodePublicKey(
	nodeUrl: string,
): Promise<TransportNodePub> {
	const healthUrl = nodeUrl.endsWith("/health")
		? nodeUrl
		: `${nodeUrl}/health`;

	const response = await axios.get<HealthResponse>(healthUrl, {
		timeout: 5_000,
	});

	return {
		id: response.data.role,
		publicKey: response.data.publicKey as `0x${string}`,
	};
}

async function main() {
	await initCrypto();

	// 3-hop path: entry → middle → exit
	const entryUrl = "http://127.0.0.1:9100";
	const middleUrl = "http://127.0.0.1:9101";
	const exitUrl = "http://127.0.0.1:9102";
	const rpcUrl = "http://127.0.0.1:9933"; // DaoChain HTTP RPC

	console.log("[TransportRpc] Fetching transport node public keys...");

	// Fetch public keys from all nodes
	const entryNode = await fetchNodePublicKey(entryUrl);
	const middleNode = await fetchNodePublicKey(middleUrl);
	const exitNode = await fetchNodePublicKey(exitUrl);

	console.log(`[TransportRpc] Entry node: ${entryNode.id} (${entryNode.publicKey.slice(0, 20)}...)`);
	console.log(`[TransportRpc] Middle node: ${middleNode.id} (${middleNode.publicKey.slice(0, 20)}...)`);
	console.log(`[TransportRpc] Exit node: ${exitNode.id} (${exitNode.publicKey.slice(0, 20)}...)`);

	// Transport nodes in hop order: [entry, middle, exit]
	const transportNodes: TransportNodePub[] = [
		entryNode,
		middleNode,
		exitNode,
	];

	// Real JSON-RPC body
	const rpcBody = {
		jsonrpc: "2.0",
		id: 1,
		method: "chain_getBlock",
		params: [] as unknown[],
	};

	console.log(`[TransportRpc] Sending JSON-RPC request over transport mix...`);
	console.log(`[TransportRpc] Method: ${rpcBody.method}`);
	console.log(`[TransportRpc] Target RPC: ${rpcUrl}`);

	// Sender keypair (can be reused across calls)
	const sender = generateKeypair();

	// Convert TransportNodePub[] to TransportNode[]
	const transportNodesForClient = transportNodes.map((node) => ({
		url: node.id === "entry" ? entryUrl : node.id === "middle" ? middleUrl : exitUrl,
		publicKey: node.publicKey,
	}));

	const response = await sendRpcOverTransportMix({
		entryNodeUrl: entryUrl,
		rpcUrl,
		method: rpcBody.method,
		params: rpcBody.params,
		transportNodes: transportNodesForClient,
		senderSecretKeyHex: toHex(sender.secretKey),
	});

	console.log("\n[TransportRpc] Transport-mix RPC result:");
	console.log(JSON.stringify(response, null, 2));

	if (
		response &&
		typeof response === "object" &&
		"result" in response
	) {
		console.log("\n✅ Successfully received JSON-RPC result over transport mix!");
		if (
			"block" in (response.result as any) &&
			(response.result as any).block
		) {
			const block = (response.result as any).block;
			console.log(
				`   Block number: ${block.header?.number || "N/A"}`,
			);
			console.log(
				`   Block hash: ${block.header?.hash || "N/A"}`,
			);
		}
	} else if (response && typeof response === "object" && "error" in response) {
		console.error("\n❌ JSON-RPC error:", response);
		process.exit(1);
	} else {
		console.warn("\n⚠️  Unexpected response format:", response);
	}
}

main().catch((err) => {
	console.error("[TransportRpc] Failed:", err);
	if (axios.isAxiosError(err)) {
		console.error(`   HTTP ${err.response?.status}: ${err.response?.statusText}`);
		console.error(`   Response: ${JSON.stringify(err.response?.data)}`);
	}
	process.exit(1);
});

