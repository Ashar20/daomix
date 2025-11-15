import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const DaoMixVoting = await ethers.getContractFactory("DaoMixVoting");
  const voting = await DaoMixVoting.deploy();

  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("DaoMixVoting deployed to:", address);

  // Export the address for use in environment variables
  console.log("\nAdd this to your .env file:");
  console.log(`DAOMIX_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

