// Quick Sepolia Deployment - Just deploy contracts, no minting
const hre = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log("\nQuick Sepolia Deployment");
  console.log("================================");
  console.log(`Deploying from: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH\n`);

  // Deploy MedicalAsset
  console.log("Deploying MedicalAsset...");
  const MedicalAsset = await ethers.getContractFactory('MedicalAsset');
  const medicalAsset = await MedicalAsset.deploy(deployer.address);
  await medicalAsset.deployed();
  console.log(`MedicalAsset deployed: ${medicalAsset.address}`);

  // Deploy HospitalEscrow
  console.log("\n📦 Deploying HospitalEscrow...");
  const HospitalEscrow = await ethers.getContractFactory('HospitalEscrow');
  const escrow = await HospitalEscrow.deploy(
    medicalAsset.address,
    deployer.address,  // hospitalAdmin
    deployer.address   // storeManager
  );
  await escrow.deployed();
  console.log(`HospitalEscrow deployed: ${escrow.address}`);

  // Authorize escrow contract
  console.log("\nAuthorizing escrow contract...");
  const tx = await medicalAsset.setEscrowContract(escrow.address);
  await tx.wait();
  console.log("Escrow authorized");

  // Summary
  console.log("\n================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("================================");
  console.log(`MedicalAsset:   ${medicalAsset.address}`);
  console.log(`HospitalEscrow: ${escrow.address}`);
  console.log("\nUpdate src/config.json with these addresses:");
  console.log(`"11155111": {`);
  console.log(`  "medicalAsset": { "address": "${medicalAsset.address}" },`);
  console.log(`  "hospitalEscrow": { "address": "${escrow.address}" }`);
  console.log(`}`);
  console.log("\nYou can mint NFTs later from the frontend!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
