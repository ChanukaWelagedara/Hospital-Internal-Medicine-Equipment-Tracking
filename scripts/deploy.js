// Internal Hospital Medicine & Equipment Issuing System Deployment Script
// Roles: Hospital Admin, Store Manager, Ward Authorities
const hre = require("hardhat");

async function main() {
  // Setup accounts - Three separate roles
  const signers = await ethers.getSigners()
  const hospitalAdmin = signers[0]
  const storeManager = signers[1] || hospitalAdmin
  const wardAuthority = signers[2] || hospitalAdmin

  const network = await ethers.provider.getNetwork()
  console.log(`\nDeploying to network: ${network.name} (Chain ID: ${network.chainId})`)
  console.log("Deploying Internal Hospital Issuing & Tracking System...\n")
  console.log("Active Accounts:")
  console.log(`  Hospital Admin: ${hospitalAdmin.address}`)
  if (signers.length > 1) {
    console.log(`  Store Manager: ${storeManager.address}`)
  }
  if (signers.length > 2) {
    console.log(`  Ward Authority: ${wardAuthority.address}`)
  }
  if (signers.length === 1) {
    console.log(`  (Using single account for all roles on testnet)`)
  }
  console.log()

  // Deploy MedicalAsset NFT contract with hospital admin
  const MedicalAsset = await ethers.getContractFactory('MedicalAsset')
  const medicalAsset = await MedicalAsset.deploy(hospitalAdmin.address)
  await medicalAsset.deployed()

  console.log(`Deployed MedicalAsset Contract at: ${medicalAsset.address}`)
  console.log(`Minting hospital assets (medicines and equipment)...\n`)

  // Mint medicine batches with data URLs (no external files needed)
  const hospitalAssets = [
    {
      metadata: {
        name: "Paracetamol 500mg",
        description: "Pain relief and fever reducer tablets",
        itemType: "Medicine",
        attributes: [
          { trait_type: "Item Type", value: "Medicine" },
          { trait_type: "Batch ID", value: "PAR-2026-001" },
          { trait_type: "Manufacturer", value: "PharmaCorp Industries" },
          { trait_type: "Medicine Type", value: "Analgesic" },
          { trait_type: "Active Ingredient", value: "Paracetamol 500mg" },
          { trait_type: "Dosage Form", value: "Tablet" }
        ]
      },
      quantity: 10000,
      itemType: 0
    },
    {
      metadata: {
        name: "Amoxicillin 250mg",
        description: "Antibiotic for bacterial infections",
        itemType: "Medicine",
        attributes: [
          { trait_type: "Item Type", value: "Medicine" },
          { trait_type: "Batch ID", value: "AMX-2026-002" },
          { trait_type: "Manufacturer", value: "MediPharm Ltd" },
          { trait_type: "Medicine Type", value: "Antibiotic" },
          { trait_type: "Active Ingredient", value: "Amoxicillin 250mg" },
          { trait_type: "Dosage Form", value: "Capsule" }
        ]
      },
      quantity: 5000,
      itemType: 0
    },
    {
      metadata: {
        name: "Ibuprofen 400mg",
        description: "Anti-inflammatory pain relief",
        itemType: "Medicine",
        attributes: [
          { trait_type: "Item Type", value: "Medicine" },
          { trait_type: "Batch ID", value: "IBU-2026-003" },
          { trait_type: "Manufacturer", value: "HealthCare Solutions" },
          { trait_type: "Medicine Type", value: "NSAID" },
          { trait_type: "Active Ingredient", value: "Ibuprofen 400mg" },
          { trait_type: "Dosage Form", value: "Tablet" }
        ]
      },
      quantity: 8000,
      itemType: 0
    }
  ]

  for (let i = 0; i < hospitalAssets.length; i++) {
    const asset = hospitalAssets[i]
    // Convert metadata to data URL
    const metadataString = JSON.stringify(asset.metadata, null, 2)
    const dataUrl = `data:application/json;base64,${Buffer.from(metadataString).toString('base64')}`
    
    const transaction = await medicalAsset.connect(hospitalAdmin).mintAsset(
      dataUrl,
      asset.quantity,
      asset.itemType
    )
    await transaction.wait()
    const itemTypeStr = asset.itemType === 0 ? "Medicine" : "Equipment"
    console.log(`  Minted: ${asset.metadata.name} (${itemTypeStr}) - Quantity: ${asset.quantity} units`)
  }

  // Deploy HospitalEscrow contract with hospital roles
  console.log("\n")
  const HospitalEscrow = await ethers.getContractFactory('HospitalEscrow')
  const hospitalEscrow = await HospitalEscrow.deploy(
    medicalAsset.address,
    hospitalAdmin.address,
    storeManager.address
  )
  await hospitalEscrow.deployed()

  console.log(`Deployed HospitalEscrow Contract at: ${hospitalEscrow.address}`)
  
  // Approve escrow contract to manage assets
  console.log(`\nApproving HospitalEscrow to manage assets...`)
  for (let i = 0; i < 3; i++) {
    let transaction = await medicalAsset.connect(hospitalAdmin).approve(hospitalEscrow.address, i + 1)
    await transaction.wait()
  }
  console.log(`Approvals completed.`)

  console.log(`\nDeployment completed successfully!`)
  console.log(`\n=== CONTRACT ADDRESSES ===`)
  console.log(`  MedicalAsset NFT: ${medicalAsset.address}`)
  console.log(`  HospitalEscrow: ${hospitalEscrow.address}`)
  console.log(`\n=== ACTIVE ACCOUNTS ===`)
  console.log(`  Hospital Admin: ${hospitalAdmin.address}`)
  console.log(`  Store Manager: ${storeManager.address}`)
  console.log(`  Ward Authority: ${wardAuthority.address}`)
  console.log(`\n=== NEXT STEPS ===`)
  console.log(`1. Ward authority can request assets using requestAsset()`)
  console.log(`2. Store manager approves with approveByStore()`)
  console.log(`3. Hospital admin approves and issues with approveByAdmin() and issueAsset()`)
  console.log(`4. NFT status is updated automatically to track issuance`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
