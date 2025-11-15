import { HexString } from "./shared";
import { fromHex, toHex } from "./crypto";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";

export interface Shard {
	// Unique per shard, derived deterministically from ciphertext + index.
	shardId: HexString;
	// Index of this shard in the original sequence.
	shardIndex: number;
	// Total number of shards for this ciphertext.
	totalShards: number;
	// Hex-encoded bytes of this shard (slice of the original ciphertext).
	data: HexString;
}

/**
 * Split a hex-encoded ciphertext into multiple shards.
 *
 * @param ciphertext - 0x-prefixed hex string
 * @param shardCount - Number of shards to create (must be > 0)
 * @returns Array of Shard objects covering the entire ciphertext
 */
export function shardCiphertext(
	ciphertext: HexString,
	shardCount: number,
): Shard[] {
	if (!ciphertext.startsWith("0x")) {
		throw new Error("ciphertext must be 0x-prefixed hex");
	}
	if (shardCount <= 0) {
		throw new Error("shardCount must be > 0");
	}

	const bytes = fromHex(ciphertext);
	const length = bytes.length;

	if (length === 0) {
		// No bytes: return a single empty shard for determinism
		return [
			{
				shardId: "0x0" as HexString,
				shardIndex: 0,
				totalShards: 1,
				data: "0x" as HexString,
			},
		];
	}

	const shardSize = Math.ceil(length / shardCount);
	const shards: Shard[] = [];

	for (let i = 0; i < shardCount; i++) {
		const start = i * shardSize;
		if (start >= length) {
			break;
		}
		const end = Math.min(start + shardSize, length);
		const slice = bytes.slice(start, end);

		// Deterministic shardId: hash of (index, totalShards, slice)
		const idBytes = new Uint8Array(8 + slice.length);
		const view = new DataView(idBytes.buffer);
		view.setUint32(0, i, true);
		view.setUint32(4, shardCount, true);
		idBytes.set(slice, 8);

		// Simple deterministic ID: hex of the idBytes itself
		const shardId = toHex(idBytes);

		shards.push({
			shardId,
			shardIndex: i,
			totalShards: shardCount,
			data: toHex(slice),
		});
	}

	return shards;
}

/**
 * Reconstruct a ciphertext from shards.
 *
 * @param shards - Array of Shard objects (can be unsorted)
 * @returns Reconstructed hex-encoded ciphertext
 */
export function reconstructFromShards(shards: Shard[]): HexString {
	if (shards.length === 0) {
		return "0x" as HexString;
	}

	// Sort by shardIndex
	const sorted = [...shards].sort((a, b) => a.shardIndex - b.shardIndex);

	// Concatenate bytes
	const parts = sorted.map((s) => fromHex(s.data));
	const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
	const out = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}

	return toHex(out);
}

export interface ShardBundle {
	// Unique bundle ID, derived from shard IDs.
	bundleId: HexString;
	// Shards included in this bundle (no padding yet).
	shards: Shard[];
	// Merkle root over shard commitments (shard.data hashes).
	bundleCommitment: HexString;
}

/**
 * Compute a commitment for a single shard (keccak256 of shard.data).
 */
function shardCommitment(shard: Shard): Buffer {
	const bytes = fromHex(shard.data);
	return keccak256(Buffer.from(bytes));
}

/**
 * Group shards into bundles and compute bundle commitments.
 *
 * @param shards - Array of Shard objects
 * @param bundleSize - Maximum number of shards per bundle (must be > 0)
 * @returns Array of ShardBundle objects
 */
export function createBundles(
	shards: Shard[],
	bundleSize: number,
): ShardBundle[] {
	if (bundleSize <= 0) {
		throw new Error("bundleSize must be > 0");
	}
	if (shards.length === 0) {
		return [];
	}

	const bundles: ShardBundle[] = [];

	for (let i = 0; i < shards.length; i += bundleSize) {
		const group = shards.slice(i, i + bundleSize);

		// Bundle ID = keccak256 of concatenated shardIds
		const idBytesParts = group.map((s) => fromHex(s.shardId));
		const totalIdLen = idBytesParts.reduce((sum, b) => sum + b.length, 0);
		const idBytes = new Uint8Array(totalIdLen);
		{
			let offset = 0;
			for (const part of idBytesParts) {
				idBytes.set(part, offset);
				offset += part.length;
			}
		}
		const bundleIdHash = keccak256(Buffer.from(idBytes));
		const bundleId = (`0x${bundleIdHash.toString("hex")}` as HexString);

		// Bundle commitment = Merkle root over shard commitments
		const leaves = group.map((shard) => shardCommitment(shard));
		const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
		const root = tree.getRoot();
		const bundleCommitment =
			root.length === 0
				? ("0x" as HexString)
				: (`0x${root.toString("hex")}` as HexString);

		bundles.push({
			bundleId,
			shards: group,
			bundleCommitment,
		});
	}

	return bundles;
}

/**
 * Flatten bundles back into a single array of shards.
 *
 * @param bundles - Array of ShardBundle objects
 * @returns Array of Shard objects in deterministic order (by shardIndex within each bundle)
 */
export function flattenBundles(bundles: ShardBundle[]): Shard[] {
	if (bundles.length === 0) {
		return [];
	}

	const out: Shard[] = [];
	for (const bundle of bundles) {
		const sorted = [...bundle.shards].sort(
			(a, b) => a.shardIndex - b.shardIndex,
		);
		out.push(...sorted);
	}
	return out;
}
