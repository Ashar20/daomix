import { ethers } from "hardhat";
import { expect } from "chai";

describe("DaoMixVoting", () => {
  it("creates election, registers voters, accepts ballots, and finalizes tally", async () => {
    const [admin, tallyAuthority, voter1, voter2] = await ethers.getSigners();

    const DaoMixVoting = await ethers.getContractFactory("DaoMixVoting");
    const voting = await DaoMixVoting.connect(admin).deploy();
    await voting.waitForDeployment();

    const block = await ethers.provider.getBlock("latest");
    const now = block!.timestamp;

    const registrationDeadline = now + 60;
    const votingDeadline = now + 120;

    const tx = await voting
      .connect(admin)
      .createElection(
        "Test Election",
        registrationDeadline,
        votingDeadline,
        tallyAuthority.address,
      );
    await tx.wait();

    const electionId = await voting.electionCount();
    expect(electionId).to.equal(1n);

    await voting.connect(admin).registerVoter(electionId, voter1.address);
    await voting.connect(admin).registerVoter(electionId, voter2.address);

    await voting.connect(voter1).castVote(electionId, "0x1234");
    await voting.connect(voter2).castVote(electionId, "0xdeadbeef");

    const ballots = await voting.getBallots(electionId);
    expect(ballots.length).to.equal(2);

    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);

    const inputRoot = ("0x" + "11".repeat(32)) as `0x${string}`;
    const outputRoot = ("0x" + "22".repeat(32)) as `0x${string}`;

    await voting
      .connect(admin)
      .setMixCommitments(electionId, inputRoot, outputRoot);

    const resultUri = "ipfs://fake-result";
    const resultHash = ("0x" + "aa".repeat(32)) as `0x${string}`;

    await voting
      .connect(tallyAuthority)
      .submitTally(electionId, resultUri, resultHash);

    const election = await voting.elections(electionId);
    expect(election.finalized).to.equal(true);
  });
});

