# 🏥 Hospital Internal Medicine Equipment Tracking System

> A blockchain-based internal asset tracking and management system for hospitals using Ethereum smart contracts and ERC-721 NFTs

[![Solidity](https://img.shields.io/badge/Solidity-0.8.17-363636?style=flat&logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.12.0-yellow?style=flat&logo=hardhat)](https://hardhat.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![Sepolia](https://img.shields.io/badge/Network-Sepolia%20Testnet-blue?style=flat&logo=ethereum)](https://sepolia.etherscan.io/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Solution](#-solution)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Workflow](#-workflow)
- [Features](#-features)
- [Smart Contract Deployment](#-smart-contract-deployment)
- [How to Run Locally](#-how-to-run-locally)
- [Future Enhancements](#-future-enhancements)
- [License](#-license)

---

## 🔍 Overview

![System Overview](images/1.png)

The **Hospital Internal Medicine Equipment Tracking System** is a decentralized application (DApp) that leverages blockchain technology to solve critical challenges in hospital asset management. This system provides an immutable, transparent, and secure platform for tracking medicines and medical equipment within hospital premises.

Unlike traditional supply chain solutions, this is an **internal hospital tracking system** where NFTs serve as digital records for medicines and equipment, enabling real-time visibility, accountability, and audit trails. Each asset is represented as an ERC-721 NFT, containing metadata such as batch information, quantities, expiry dates, and issuance history.

**Key Highlights:**
- 🔐 **Immutable Records**: All transactions are recorded on the Ethereum blockchain
- 👥 **Role-Based Access Control (RBAC)**: Three-tier authorization system
- 🎯 **Real-Time Tracking**: Monitor asset movement and status updates
- 📊 **Audit Trail**: Complete history of requests, approvals, and issuances
- 🌐 **Decentralized**: No single point of failure or data manipulation

---

## ❗ Problem Statement

Modern hospitals face significant challenges in managing their internal medicine and equipment inventory:

1. **Lack of Transparency**: Manual record-keeping systems are prone to errors and inconsistencies
2. **Inventory Mismanagement**: Difficulty in tracking real-time availability and location of assets
3. **Accountability Issues**: Unclear audit trails for who requested, approved, and issued items
4. **Data Tampering**: Centralized databases are vulnerable to unauthorized modifications
5. **Inefficient Workflows**: Time-consuming approval processes with paper-based documentation
6. **Expiry Management**: Poor tracking of medicine expiry dates leading to wastage
7. **Resource Allocation**: Lack of data-driven insights for procurement and distribution

These challenges result in operational inefficiencies, increased costs, compliance risks, and potential patient safety concerns.

---

## ✅ Solution

![Smart Contract Structure](images/2.png)

Our blockchain-based solution addresses these challenges through:

### Core Components

1. **Smart Contracts**
   - **MedicalAsset.sol**: ERC-721 NFT contract for tokenizing medicines and equipment
   - **HospitalEscrow.sol**: Escrow contract managing the approval workflow and issuance logic

2. **Role-Based Access Control (RBAC)**
   
   ![RBAC System](images/3.png)
   
   - **Hospital Admin**: Mints new assets (NFTs), approves final issuance
   - **Store Manager**: Manages inventory, approves availability
   - **Ward Authority**: Requests medicines/equipment for patient care

3. **Decentralized Storage**
   - Asset metadata stored as JSON files
   - Immutable records on Ethereum blockchain (Sepolia testnet)

4. **Web Interface**
   - React-based dashboard for each role
   - Real-time status updates and notifications
   - Search and filter capabilities

---

## 🛠️ Tech Stack

### Blockchain Layer
- **Solidity 0.8.17**: Smart contract development
- **Hardhat**: Development environment, testing, and deployment
- **OpenZeppelin Contracts**: Secure, audited ERC-721 implementation
- **Ethers.js**: Blockchain interaction library

### Frontend
- **React.js 18.2.0**: Component-based UI framework
- **Tailwind CSS**: Utility-first styling
- **Web3 Integration**: MetaMask connectivity

### Network
- **Sepolia Testnet**: Ethereum test network for deployment
- **Chain ID**: 11155111

### Development Tools
- **Node.js**: Runtime environment
- **npm**: Package management
- **Git**: Version control

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Admin Panel  │  │ Store Panel  │  │  Ward Panel  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ Web3/Ethers.js
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Ethereum Sepolia Testnet                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Smart Contracts Layer                  │  │
│  │  ┌──────────────────┐  ┌──────────────────────┐ │  │
│  │  │ MedicalAsset.sol │  │ HospitalEscrow.sol   │ │  │
│  │  │  (ERC-721 NFT)   │  │  (Workflow Logic)    │ │  │
│  │  └──────────────────┘  └──────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Smart Contract Structure

![Contract Architecture](images/2.png)

**MedicalAsset Contract**
- Inherits from OpenZeppelin's ERC721URIStorage
- Mints NFTs representing medicine batches or equipment units
- Tracks quantities, status, and metadata
- Emits events for all state changes

**HospitalEscrow Contract**
- Manages issuance request lifecycle
- Implements multi-signature approval workflow
- Updates NFT status upon successful issuance
- Maintains request history and audit logs

---

## 🔄 Workflow

### Asset Issuance Process

```
Ward Authority              Store Manager           Hospital Admin
      │                          │                        │
      │ 1. Request Asset         │                        │
      ├─────────────────────────►│                        │
      │                          │                        │
      │                          │ 2. Check Availability  │
      │                          │    & Approve           │
      │                          ├───────────────────────►│
      │                          │                        │
      │                          │                        │ 3. Final Approval
      │                          │                        │    & Issue Asset
      │◄──────────────────────────────────────────────────┤
      │ 4. Receive Asset         │                        │
      │    (Status Updated)      │                        │
```

### Detailed Steps

1. **Request Submission**
   - Ward Authority logs into the system
   - Searches for required medicine/equipment
   - Submits request with patient ID, ward name, and quantity
   - Request stored on-chain with `isPending = true`

2. **Store Manager Review**
   - Views all pending requests
   - Verifies inventory availability
   - Checks expiry dates for medicines
   - Approves or rejects with remarks
   - Status updated: `storeApproved = true`

3. **Admin Approval**
   - Reviews store-approved requests
   - Performs final authorization check
   - Approves issuance
   - Smart contract executes asset transfer
   - NFT status updated (InStore → IssuedToWard)
   - Quantity reduced in inventory

4. **Record Keeping**
   - All actions logged with timestamps
   - Immutable audit trail maintained
   - Event emissions for frontend notifications

---

## ✨ Features

![System Advantages](images/4.png)

### Core Functionality

- **🎫 NFT-Based Asset Tracking**
  - Each medicine batch or equipment unit represented as an ERC-721 NFT
  - Unique token IDs for granular tracking
  - Metadata includes name, description, quantity, expiry date, manufacturer

- **👥 Three-Tier RBAC**
  - Hospital Admin: Minting and final approval authority
  - Store Manager: Inventory management and availability verification
  - Ward Authority: Request submission for patient care

- **📦 Quantity Management**
  - Track total quantity and remaining quantity for each asset
  - Automatic reduction upon issuance
  - Prevent over-allocation

- **📊 Status Tracking**
  - InStore: Available in hospital pharmacy/storage
  - IssuedToWard: Dispatched to ward for patient care
  - IssuedToPatient: Administered to specific patient
  - Expired: Past expiry date
  - Disposed: Properly discarded/written off

- **🔍 Advanced Search**
  - Filter by asset type (Medicine/Equipment)
  - Search by name, ID, or batch number
  - View detailed asset information

- **📝 Approval Workflow**
  - Multi-level approval mechanism
  - Request tracking with status updates
  - Store and admin remarks/comments

- **📈 Dashboard Analytics**
  - Real-time inventory levels
  - Pending request counts
  - Issuance history
  - Expiry alerts

- **🔐 Security Features**
  - Immutable blockchain records
  - Access control modifiers
  - Event-driven architecture for transparency
  - MetaMask integration for secure authentication

---

## 🚀 Smart Contract Deployment

### Network Configuration

The smart contracts are deployed on the **Sepolia Ethereum Testnet**, a proof-of-stake test network that mirrors Ethereum mainnet functionality without real ETH costs.

**Network Details:**
- **Network Name**: Sepolia
- **Chain ID**: 11155111
- **RPC URL**: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
- **Block Explorer**: [https://sepolia.etherscan.io/](https://sepolia.etherscan.io/)

### Prerequisites

1. **Get Sepolia Test ETH**
   - Visit [Sepolia Faucet](https://sepoliafaucet.com/)
   - Or use [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
   - Request test ETH for deployment (requires ~0.05 ETH)

2. **Setup Environment Variables**
   
   Create a `.env` file in the root directory:
   ```env
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
   PRIVATE_KEY_ADMIN=your_hospital_admin_private_key
   PRIVATE_KEY_STORE=your_store_manager_private_key
   PRIVATE_KEY_WARD=your_ward_authority_private_key
   ```

   ⚠️ **Security Warning**: Never commit `.env` files or expose private keys!

### Deployment Steps

1. **Compile Contracts**
   ```bash
   npx hardhat compile
   ```

2. **Deploy to Sepolia Testnet**
   ```bash
   npx hardhat run scripts/deploy-with-gas.js --network sepolia
   ```

3. **Verify Deployment**
   - Check transaction on [Sepolia Etherscan](https://sepolia.etherscan.io/)
   - Note contract addresses for frontend configuration
   - Save deployment details in `src/config.json`

### Contract Verification (Optional)

Verify contracts on Etherscan for public transparency:
```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

### Post-Deployment Configuration

Update `src/config.json` with deployed contract addresses:
```json
{
  "MedicalAssetAddress": "0xYourMedicalAssetContractAddress",
  "HospitalEscrowAddress": "0xYourHospitalEscrowContractAddress",
  "networkId": 11155111
}
```

---

## 💻 How to Run Locally

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension
- Git

### Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/Hospital-Internal-Medicine-Equipment-Tracking.git
   cd Hospital-Internal-Medicine-Equipment-Tracking
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   
   Create `.env` file with required variables (see Deployment section)

4. **Compile Smart Contracts**
   ```bash
   npx hardhat compile
   ```

5. **Run Local Blockchain (Optional)**
   
   For local testing without Sepolia:
   ```bash
   npx hardhat node
   ```

6. **Deploy Contracts**
   
   For Sepolia testnet:
   ```bash
   npx hardhat run scripts/deploy-with-gas.js --network sepolia
   ```
   
   For local network:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

7. **Update Configuration**
   
   Copy deployed contract addresses to `src/config.json`

8. **Start React Frontend**
   ```bash
   npm start
   ```

9. **Configure MetaMask**
   - Add Sepolia network to MetaMask
   - Import accounts using private keys from `.env`
   - Switch to appropriate account based on role

10. **Access Application**
    - Open browser at `http://localhost:3000`
    - Connect MetaMask wallet
    - Navigate to role-specific dashboard

### Testing

Run smart contract tests:
```bash
npx hardhat test
```

Check test coverage:
```bash
npx hardhat coverage
```

### Troubleshooting

**Issue: Transaction Fails**
- Ensure sufficient Sepolia ETH in wallet
- Check gas price settings in `hardhat.config.js`

**Issue: Contract Not Found**
- Verify contract addresses in `config.json`
- Check network ID matches Sepolia (11155111)

**Issue: MetaMask Connection Failed**
- Ensure correct network selected
- Clear MetaMask activity/nonce data

---

## 🔮 Future Enhancements

### Short-Term Goals

- **📱 Mobile Application**
  - React Native app for on-the-go access
  - QR code scanning for quick asset lookup

- **📊 Advanced Analytics**
  - Predictive analytics for inventory management
  - Usage pattern visualization
  - Automated expiry notifications

- **🔔 Real-Time Notifications**
  - Push notifications for approval requests
  - Email/SMS alerts for critical events

### Mid-Term Goals

- **🏢 Multi-Hospital Network**
  - Inter-hospital asset sharing and transfers
  - Centralized procurement dashboard
  - Hospital-to-hospital lending protocols

- **📜 Compliance & Reporting**
  - Automated regulatory compliance reports
  - Export data for audits
  - Digital signatures for audit trails

- **🤖 AI Integration**
  - Machine learning for demand forecasting
  - Anomaly detection for unusual patterns
  - Chatbot for query resolution

### Long-Term Vision

- **🌍 IPFS Integration**
  - Decentralized storage for asset metadata
  - Reduced on-chain storage costs

- **⚡ Layer 2 Solutions**
  - Migration to Polygon or Arbitrum for lower gas costs
  - Faster transaction finality

- **🔗 Interoperability**
  - Integration with existing Hospital Management Systems (HMS)
  - API endpoints for third-party applications
  - Cross-chain compatibility

- **📋 Supply Chain Extension**
  - Track assets from manufacturer to hospital
  - Vendor management and procurement workflows
  - Cold chain monitoring for temperature-sensitive items

- **🛡️ Enhanced Security**
  - Multi-signature wallets for critical operations
  - Time-locked transactions
  - Emergency pause mechanisms

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Hospital Internal Medicine Equipment Tracking System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---


---

## 🙏 Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Hardhat development team
- Ethereum Foundation for blockchain infrastructure
- React.js community

---



<div align="center">

**⭐ If you find this project useful, please consider giving it a star!**

Made with ❤️ for improving healthcare infrastructure

</div>
