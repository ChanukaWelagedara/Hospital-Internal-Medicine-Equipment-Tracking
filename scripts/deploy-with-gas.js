// Deploy with explicit gas settings
const hre = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const hospitalAdmin = signers[0];
  const storeManager = signers[1] || hospitalAdmin;
  const wardAuthority = signers[2] || hospitalAdmin;

  console.log("\nDeploying Hospital System to Sepolia with explicit gas");
  console.log("Active Accounts:");
  console.log(`  Hospital Admin: ${hospitalAdmin.address}`);
  if (signers.length > 1) {
    console.log(`  Store Manager: ${storeManager.address}`);
  }
  if (signers.length > 2) {
    console.log(`  Ward Authority: ${wardAuthority.address}`);
  }
  if (signers.length === 1) {
    console.log(`  (Using single account for all roles on testnet)`);
  }
  
  const balance = await ethers.provider.getBalance(hospitalAdmin.address);
  console.log("Balance:", ethers.utils.formatEther(balance), "ETH\n");

  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();
  console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
  
  // Deploy MedicalAsset with explicit gas
  console.log("\nDeploying MedicalAsset...");
  const MedicalAsset = await ethers.getContractFactory('MedicalAsset');
  
  const medicalAsset = await MedicalAsset.deploy(hospitalAdmin.address, {
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
    hospitalAdmin.address,
    storeManager.address,
    {
      gasLimit: 3000000,
      gasPrice: gasPrice.mul(120).div(100)
    }
  );
  
  console.log("Transaction sent! Hash:", escrow.deployTransaction.hash);
  console.log("Waiting for confirmation...");
  
  await escrow.deployed();
  console.log(`HospitalEscrow: ${escrow.address}`);

  console.log("\n================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("================================");
  console.log(`MedicalAsset:   ${medicalAsset.address}`);
  console.log(`HospitalEscrow: ${escrow.address}`);
  console.log("\nActive Accounts:");
  console.log(`  Hospital Admin: ${hospitalAdmin.address}`);
  console.log(`  Store Manager: ${storeManager.address}`);
  console.log(`  Ward Authority: ${wardAuthority.address}`);
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
