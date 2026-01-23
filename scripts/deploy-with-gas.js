// Deploy with explicit gas settings
const hre = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log("\nDeploying to Sepolia with explicit gas");
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.utils.formatEther(balance), "ETH\n");

  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();
  console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
  
  // Deploy MedicalAsset with explicit gas
  console.log("\nDeploying MedicalAsset...");
  const MedicalAsset = await ethers.getContractFactory('MedicalAsset');
  
  const medicalAsset = await MedicalAsset.deploy(deployer.address, {
    gasLimit: 5000000,
    gasPrice: gasPrice.mul(120).div(100) // 20% higher than current
  });
  
  console.log("Transaction sent! Hash:", medicalAsset.deployTransaction.hash);
  console.log("Waiting for confirmation...");
  
  await medicalAsset.deployed();
  console.log(`MedicalAsset: ${medicalAsset.address}`);

  // Deploy HospitalEscrow
  console.log("\nDeploying HospitalEscrow...");
  const HospitalEscrow = await ethers.getContractFactory('HospitalEscrow');
  
  const escrow = await HospitalEscrow.deploy(
    medicalAsset.address,
    deployer.address,
    deployer.address,
    {
      gasLimit: 3000000,
      gasPrice: gasPrice.mul(120).div(100)
    }
  );
  
  console.log("Transaction sent! Hash:", escrow.deployTransaction.hash);
  console.log("Waiting for confirmation...");
  
  await escrow.deployed();
  console.log(`HospitalEscrow: ${escrow.address}`);

  // Authorize escrow
  console.log("\nAuthorizing escrow...");
  const tx = await medicalAsset.setEscrowContract(escrow.address, {
    gasLimit: 100000,
    gasPrice: gasPrice.mul(120).div(100)
  });
  
  console.log("Transaction sent! Hash:", tx.hash);
  await tx.wait();
  console.log("Authorized");

  console.log("\n================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("================================");
  console.log(`MedicalAsset:   ${medicalAsset.address}`);
  console.log(`HospitalEscrow: ${escrow.address}`);
  console.log("\nUpdate src/config.json:");
  console.log(`"11155111": {`);
  console.log(`  "medicalAsset": { "address": "${medicalAsset.address}" },`);
  console.log(`  "hospitalEscrow": { "address": "${escrow.address}" }`);
  console.log(`}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
