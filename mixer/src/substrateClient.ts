import "dotenv/config";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";

export interface DaoChainClients {
	api: ApiPromise;
	admin: ReturnType<Keyring["addFromUri"]>;
	tally: ReturnType<Keyring["addFromUri"]>;
}

const DEFAULT_WS = "ws://127.0.0.1:9944";

export async function connectDaoChain(): Promise<DaoChainClients> {
	const endpoint = process.env.DAOCHAIN_WS_URL || DEFAULT_WS;
	const adminSeed = process.env.DAOCHAIN_ADMIN_SEED;
	const tallySeed = process.env.DAOCHAIN_TALLY_SEED;

	if (!adminSeed) {
		throw new Error("DAOCHAIN_ADMIN_SEED is not set");
	}
	if (!tallySeed) {
		throw new Error("DAOCHAIN_TALLY_SEED is not set");
	}

	const provider = new WsProvider(endpoint);
	const api = await ApiPromise.create({ provider });

	const keyring = new Keyring({ type: "sr25519" });
	const admin = keyring.addFromUri(adminSeed);
	const tally = keyring.addFromUri(tallySeed);

	// Simple real logging (not a demo script, just useful info for the orchestrator/CLI)
	const [chain, nodeName, nodeVersion] = await Promise.all([
		api.rpc.system.chain(),
		api.rpc.system.name(),
		api.rpc.system.version(),
	]);

	console.log(`🔗 DaoChain connected at ${endpoint}`);
	console.log(
		`📦 Chain: ${chain.toString()} | Node: ${nodeName.toString()} v${nodeVersion.toString()}`,
	);

	return { api, admin, tally };
}

/**
 * Create a new election on DaoChain.
 */
export async function createElectionTx(
	clients: DaoChainClients,
	electionId: number,
	registrationDeadline: number,
	votingDeadline: number,
): Promise<string> {
	const { api, admin, tally } = clients;

	const tx = api.tx.daomixVoting.createElection(
		electionId,
		tally.address, // tally_authority
		registrationDeadline,
		votingDeadline,
	);

	const hash = await tx.signAndSend(admin);
	console.log(`✅ createElection submitted, hash: ${hash.toString()}`);
	return hash.toString();
}

/**
 * Register a voter for an election.
 */
export async function registerVoterTx(
	clients: DaoChainClients,
	electionId: number,
	voterAddress: string,
): Promise<string> {
	const { api, admin } = clients;

	const tx = api.tx.daomixVoting.registerVoter(electionId, voterAddress);
	const hash = await tx.signAndSend(admin);
	console.log(`✅ registerVoter submitted, hash: ${hash.toString()}`);
	return hash.toString();
}

/**
 * Cast an encrypted ballot.
 */
export async function castVoteTx(
	api: ApiPromise,
	voterSuri: string,
	electionId: number,
	ciphertext: Uint8Array,
): Promise<string> {
	const keyring = new Keyring({ type: "sr25519" });
	const voter = keyring.addFromUri(voterSuri);

	const tx = api.tx.daomixVoting.castVote(electionId, ciphertext);

	const hash = await tx.signAndSend(voter);
	console.log(
		`✅ castVote submitted by ${voter.address}, hash: ${hash.toString()}`,
	);
	return hash.toString();
}

/**
 * Set mix commitments (input and output Merkle roots) for an election.
 */
export async function setMixCommitmentsTx(
	clients: DaoChainClients,
	electionId: number,
	inputRoot: Uint8Array,
	outputRoot: Uint8Array,
): Promise<string> {
	const { api, tally } = clients;

	const tx = api.tx.daomixVoting.setMixCommitments(
		electionId,
		inputRoot,
		outputRoot,
	);

	const hash = await tx.signAndSend(tally);
	console.log(`✅ setMixCommitments submitted, hash: ${hash.toString()}`);
	return hash.toString();
}

/**
 * Submit final tally results for an election.
 */
export async function submitTallyTx(
	clients: DaoChainClients,
	electionId: number,
	resultUri: Uint8Array,
	resultHash: Uint8Array,
): Promise<string> {
	const { api, tally } = clients;

	const tx = api.tx.daomixVoting.submitTally(electionId, resultUri, resultHash);

	const hash = await tx.signAndSend(tally);
	console.log(`✅ submitTally submitted, hash: ${hash.toString()}`);
	return hash.toString();
}

