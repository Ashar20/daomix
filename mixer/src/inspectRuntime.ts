import "dotenv/config";
import { ApiPromise, WsProvider } from "@polkadot/api";

async function main() {
	const wsUrl = process.env.DAOCHAIN_WS_URL || "ws://127.0.0.1:9944";
	const electionId = Number(process.env.DAOCHAIN_ELECTION_ID || "42");

	console.log("Connecting to DaoChain at", wsUrl);
	const provider = new WsProvider(wsUrl);
	const api = await ApiPromise.create({ provider });

	try {
		const metadata = api.runtimeMetadata.asLatest;

		console.log("=== Pallets on-chain ===");
		metadata.pallets.forEach((pallet, index) => {
			console.log(`#${index}`, pallet.name.toString());
		});

		const daoPallet = metadata.pallets.find((p) =>
			p.name.toString().toLowerCase().includes("daomix"),
		);

		if (!daoPallet) {
			console.error("Daomix pallet not found in metadata");
		} else {
			console.log("\n=== DaoMix Pallet Info ===");
			console.log("Name:", daoPallet.name.toString());
			// index is a Compact<u8> in metadata
			// @ts-ignore
			console.log("Index:", daoPallet.index?.toNumber?.() ?? String(daoPallet.index));

			console.log("\n--- Storage entries ---");
			const storageMeta = (daoPallet as any).storage;
			const storageItems: any[] = storageMeta?.items || storageMeta?.entries || [];
			if (storageItems.length > 0) {
				for (const item of storageItems) {
					const name = item.name.toString();
					const t = item.type;
					let kind = "Plain";
					if ((t as any).isMap) kind = "Map";
					else if ((t as any).isDoubleMap) kind = "DoubleMap";
					else if ((t as any).isNMap) kind = "NMap";
					console.log("-", name, "| kind:", kind);
				}
			} else {
				console.log("(no storage for this pallet or no items exposed)");
			}

			console.log("\n--- Calls (extrinsics) ---");
			const callsMeta = (daoPallet as any).calls;
			const variants: any[] = callsMeta?.variants || callsMeta?.variants || [];
			if (variants.length > 0) {
				variants.forEach((v, idx) => {
					console.log(`#${idx}`, v.name.toString());
				});
			} else {
				console.log("(no calls for this pallet)");
			}
		}

		console.log("\n=== Storage live check ===");
		const qAny = api.query as any;

		if (qAny.daomixVoting?.ballotCount) {
			const count = await qAny.daomixVoting.ballotCount(electionId);
			console.log(
				"[camelCase] ballotCount(",
				electionId,
				") =",
				count?.toString?.() ?? String(count),
			);
		} else {
			console.log("api.query.daomixVoting.ballotCount not found");
		}

		if (qAny.daomix_voting?.ballotCount) {
			const count2 = await qAny.daomix_voting.ballotCount(electionId);
			console.log(
				"[snake_case] ballotCount(",
				electionId,
				") =",
				count2?.toString?.() ?? String(count2),
			);
		} else {
			console.log("api.query.daomix_voting.ballotCount not found");
		}
	} finally {
		await api.disconnect();
	}
}

main().catch((err) => {
	console.error("inspectRuntime failed:", err);
	process.exitCode = 1;
});


