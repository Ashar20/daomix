import { describe, it, expect, beforeAll } from "vitest";
import { toHex } from "../src/crypto";
import {
	shardCiphertext,
	reconstructFromShards,
	Shard,
	ShardBundle,
	createBundles,
	flattenBundles,
} from "../src/sharding";
import { initCrypto } from "../src/crypto";

function makeSequentialBytes(len: number): Uint8Array {
	const out = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		out[i] = i % 256;
	}
	return out;
}

describe("sharding round-trip", () => {
	beforeAll(async () => {
		await initCrypto();
	});

	it("reconstructs exactly when length is divisible by shardCount", () => {
		const bytes = makeSequentialBytes(120);
		const hex = toHex(bytes);

		const shardCount = 4;
		const shards = shardCiphertext(hex, shardCount);

		expect(shards.length).toBe(shardCount);

		const reconstructed = reconstructFromShards(shards);
		expect(reconstructed).toBe(hex);
	});

	it("reconstructs correctly when length is NOT divisible by shardCount", () => {
		const bytes = makeSequentialBytes(123);
		const hex = toHex(bytes);

		const shardCount = 5;
		const shards = shardCiphertext(hex, shardCount);

		// At least 1 shard, at most shardCount
		expect(shards.length).toBeGreaterThan(0);
		expect(shards.length).toBeLessThanOrEqual(shardCount);

		const reconstructed = reconstructFromShards(shards);
		expect(reconstructed).toBe(hex);
	});

	it("handles empty ciphertext", () => {
		const hex = "0x" as const;
		const shards = shardCiphertext(hex, 3);

		expect(shards.length).toBe(1);
		expect(shards[0].data).toBe("0x");

		const reconstructed = reconstructFromShards(shards);
		expect(reconstructed).toBe(hex);
	});
});

describe("sharding + bundling", () => {
	beforeAll(async () => {
		await initCrypto();
	});

	it("preserves all shards through bundles and back", () => {
		const bytes = makeSequentialBytes(200);
		const hex = toHex(bytes);

		const shardCount = 5;
		const shards = shardCiphertext(hex, shardCount);

		const bundleSize = 2;
		const bundles = createBundles(shards, bundleSize);

		// Should cover all shards
		const flattened = flattenBundles(bundles);

		// Same number of shards
		expect(flattened.length).toBe(shards.length);

		// Same shard indices and data
		const sortedOriginal = [...shards].sort(
			(a, b) => a.shardIndex - b.shardIndex,
		);
		const sortedFlattened = [...flattened].sort(
			(a, b) => a.shardIndex - b.shardIndex,
		);

		for (let i = 0; i < sortedOriginal.length; i++) {
			expect(sortedFlattened[i].shardIndex).toBe(
				sortedOriginal[i].shardIndex,
			);
			expect(sortedFlattened[i].data).toBe(sortedOriginal[i].data);
			expect(sortedFlattened[i].totalShards).toBe(
				sortedOriginal[i].totalShards,
			);
		}
	});

	it("round-trips ciphertext via shards + bundles", () => {
		const bytes = makeSequentialBytes(137); // not divisible by shardCount
		const hex = toHex(bytes);

		const shardCount = 4;
		const shards = shardCiphertext(hex, shardCount);

		const bundleSize = 3;
		const bundles = createBundles(shards, bundleSize);
		const flattened = flattenBundles(bundles);

		const reconstructed = reconstructFromShards(flattened);
		expect(reconstructed).toBe(hex);
	});

	it("handles empty shard array when creating bundles", () => {
		const bundles = createBundles([], 3);
		expect(bundles.length).toBe(0);

		const flattened = flattenBundles(bundles);
		expect(flattened.length).toBe(0);
	});
});

