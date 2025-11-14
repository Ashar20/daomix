// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DaoMixVoting {
    struct Election {
        uint256 id;
        string name;
        uint256 registrationDeadline;
        uint256 votingDeadline;
        address admin;
        address tallyAuthority;
        bytes32 commitmentInputRoot;
        bytes32 commitmentOutputRoot;
        bool finalized;
    }

    uint256 public electionCount;
    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(address => bool)) public isRegisteredVoter;
    mapping(uint256 => bytes[]) private _ballots;

    event ElectionCreated(
        uint256 indexed electionId,
        string name,
        address admin,
        address tallyAuthority
    );

    event VoterRegistered(uint256 indexed electionId, address voter);

    event VoteCast(uint256 indexed electionId, address voter, uint256 index);

    event MixCommitmentsSet(
        uint256 indexed electionId,
        bytes32 inputRoot,
        bytes32 outputRoot
    );

    event TallySubmitted(
        uint256 indexed electionId,
        string resultUri,
        bytes32 resultHash
    );

    modifier onlyAdmin(uint256 electionId) {
        require(msg.sender == elections[electionId].admin, "DaoMixVoting: not admin");
        _;
    }

    modifier onlyTallyAuthority(uint256 electionId) {
        require(
            msg.sender == elections[electionId].tallyAuthority,
            "DaoMixVoting: not tally authority"
        );
        _;
    }

    function createElection(
        string calldata name,
        uint256 registrationDeadline,
        uint256 votingDeadline,
        address tallyAuthority
    ) external returns (uint256) {
        require(registrationDeadline < votingDeadline, "DaoMixVoting: bad deadlines");
        require(tallyAuthority != address(0), "DaoMixVoting: invalid tally authority");

        uint256 electionId = ++electionCount;

        elections[electionId] = Election({
            id: electionId,
            name: name,
            registrationDeadline: registrationDeadline,
            votingDeadline: votingDeadline,
            admin: msg.sender,
            tallyAuthority: tallyAuthority,
            commitmentInputRoot: bytes32(0),
            commitmentOutputRoot: bytes32(0),
            finalized: false
        });

        emit ElectionCreated(electionId, name, msg.sender, tallyAuthority);
        return electionId;
    }

    function registerVoter(uint256 electionId, address voter)
        external
        onlyAdmin(electionId)
    {
        Election memory e = elections[electionId];
        require(e.id != 0, "DaoMixVoting: invalid election");
        require(block.timestamp <= e.registrationDeadline, "DaoMixVoting: registration closed");
        require(voter != address(0), "DaoMixVoting: invalid voter");
        require(!isRegisteredVoter[electionId][voter], "DaoMixVoting: already registered");

        isRegisteredVoter[electionId][voter] = true;
        emit VoterRegistered(electionId, voter);
    }

    function castVote(uint256 electionId, bytes calldata ballotCipher) external {
        Election memory e = elections[electionId];
        require(e.id != 0, "DaoMixVoting: invalid election");
        require(block.timestamp <= e.votingDeadline, "DaoMixVoting: voting closed");
        require(isRegisteredVoter[electionId][msg.sender], "DaoMixVoting: not registered");
        require(ballotCipher.length > 0, "DaoMixVoting: empty ballot");

        _ballots[electionId].push(ballotCipher);
        uint256 index = _ballots[electionId].length - 1;

        emit VoteCast(electionId, msg.sender, index);
    }

    function getBallots(uint256 electionId) external view returns (bytes[] memory) {
        return _ballots[electionId];
    }

    function setMixCommitments(
        uint256 electionId,
        bytes32 inputRoot,
        bytes32 outputRoot
    ) external onlyAdmin(electionId) {
        Election storage e = elections[electionId];
        require(e.id != 0, "DaoMixVoting: invalid election");
        require(block.timestamp > e.votingDeadline, "DaoMixVoting: voting not finished");
        require(
            e.commitmentInputRoot == bytes32(0) &&
                e.commitmentOutputRoot == bytes32(0),
            "DaoMixVoting: commitments already set"
        );

        e.commitmentInputRoot = inputRoot;
        e.commitmentOutputRoot = outputRoot;

        emit MixCommitmentsSet(electionId, inputRoot, outputRoot);
    }

    function submitTally(
        uint256 electionId,
        string calldata resultUri,
        bytes32 resultHash
    ) external onlyTallyAuthority(electionId) {
        Election storage e = elections[electionId];
        require(e.id != 0, "DaoMixVoting: invalid election");
        require(block.timestamp > e.votingDeadline, "DaoMixVoting: voting not finished");
        require(!e.finalized, "DaoMixVoting: already finalized");
        require(bytes(resultUri).length != 0, "DaoMixVoting: empty result URI");
        require(resultHash != bytes32(0), "DaoMixVoting: empty result hash");

        e.finalized = true;

        emit TallySubmitted(electionId, resultUri, resultHash);
    }
}

