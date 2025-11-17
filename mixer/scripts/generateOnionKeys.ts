import { writeFileSync } from "fs";
import { resolve } from "path";
import { generateKeypair, initCrypto, toHex } from "../src/crypto";

async function main() {
	await initCrypto();

	const targets = [
		{ filename: ".tmp-sender.json", label: "Sender" },
		{ filename: ".tmp-tally.json", label: "Tally" },
	];

	for (const { filename, label } of targets) {
		const kp = generateKeypair();
		const data = {
			sk: toHex(kp.secretKey),
			pk: toHex(kp.publicKey),
		};

		const outputPath = resolve(__dirname, "..", "..", filename);
		writeFileSync(outputPath, JSON.stringify(data));
		console.log(`🔐 Generated ${label} keys → ${outputPath}`);
	}
}

main().catch((err) => {
	console.error("Failed to generate onion keys:", err);
	process.exit(1);
});

