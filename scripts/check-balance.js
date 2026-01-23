const hre = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const account = signers[0];
  
  const balance = await ethers.provider.getBalance(account.address);
  const balanceInEth = ethers.utils.formatEther(balance);
  
  const network = await ethers.provider.getNetwork();
  
  console.log("\n=================================");
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Account: ${account.address}`);
  console.log(`Balance: ${balanceInEth} ETH`);
  console.log("=================================\n");
  
  if (parseFloat(balanceInEth) < 0.01) {
    console.log(" Warning: Low balance! Get test ETH from a faucet.");
    console.log(" Visit: https://www.alchemy.com/faucets/ethereum-sepolia\n");
  } else {
    console.log("Sufficient balance for deployment!\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
