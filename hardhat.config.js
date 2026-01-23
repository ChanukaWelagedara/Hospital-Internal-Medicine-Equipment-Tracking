require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: [
        process.env.PRIVATE_KEY_ADMIN,      // Account 0: Hospital Admin
        process.env.PRIVATE_KEY_STORE,      // Account 1: Store Manager
        process.env.PRIVATE_KEY_WARD        // Account 2: Ward Authority
      ].filter(key => key !== undefined),   // Remove undefined keys
      chainId: 11155111,
      gas: "auto",
      gasPrice: "auto",
      timeout: 120000
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
