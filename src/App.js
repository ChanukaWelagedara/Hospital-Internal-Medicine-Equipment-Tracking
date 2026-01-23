import { ethers } from 'ethers';
import { useEffect, useState } from 'react';

// Components
import AddMedicine from './components/AddMedicine';
import Home from './components/Home';
import HospitalProcurementDashboard from './components/HospitalProcurementDashboard';
import Navigation from './components/Navigation';
import RequestFromHospital from './components/RequestFromHospital';
import Search from './components/Search';
import StoreManagerDashboard from './components/StoreManagerDashboard';

// ABIs
import HospitalEscrow from './abis/HospitalEscrow.json';
import MedicalAsset from './abis/MedicalAsset.json';

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null)
  const [escrow, setEscrow] = useState(null)
  const [medicalAsset, setMedicalAsset] = useState(null)
  
  // NEW: Hospital roles
  const [hospitalAdmin, setHospitalAdmin] = useState(null)
  const [storeManager, setStoreManager] = useState(null)
  const [userRole, setUserRole] = useState(null)

  const [account, setAccount] = useState(null)

  const [assets, setAssets] = useState([])
  const [selectedAsset, setSelectedAsset] = useState({})
  const [toggle, setToggle] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showStoreManagerDashboard, setShowStoreManagerDashboard] = useState(false);
  const [showRequestFromHospital, setShowRequestFromHospital] = useState(false);
  const [showHospitalProcurement, setShowHospitalProcurement] = useState(false);

  const loadBlockchainData = async () => {
    try {
      console.log('🔄 Loading blockchain data...');
      
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)
      const network = await provider.getNetwork()
      console.log('Connected to network:', network.chainId);

      const medicalAsset = new ethers.Contract(
        config[network.chainId].medicalAsset.address, 
        MedicalAsset.abi || MedicalAsset, 
        provider
      )
      setMedicalAsset(medicalAsset)
      console.log('MedicalAsset contract loaded:', config[network.chainId].medicalAsset.address);
      
      const totalSupply = await medicalAsset.totalSupply()
      console.log('Total NFTs minted:', totalSupply.toString());
      const assets = []

      for (var i = 1; i <= totalSupply; i++) {
        let uri = '';
        try {
          console.log(`Loading asset ${i}...`);
          
          // Check if token exists before loading
          try {
            const owner = await medicalAsset.ownerOf(i);
            if (!owner) {
              console.log(`  ⊗ Token ${i} does not exist, skipping...`);
              continue;
            }
          } catch (ownerError) {
            console.log(`  ⊗ Token ${i} does not exist, skipping...`);
            continue;
          }
          
          uri = await medicalAsset.tokenURI(i)
          console.log(`  URI: ${uri.substring(0, 100)}...`);
          
          let metadata;
          if (uri.startsWith('data:application/json')) {
            // Decode data URL
            const base64Data = uri.split(',')[1];
            const jsonString = atob(base64Data);
            metadata = JSON.parse(jsonString);
          } else {
            // Regular HTTP URL
            const response = await fetch(uri)
            metadata = await response.json()
          }
          
          // Get current quantity from contract using NEW getAssetInfo()
          const assetInfo = await medicalAsset.getAssetInfo(i)
          metadata.id = i
          metadata.totalQuantity = assetInfo.totalQuantity.toNumber()
          metadata.remainingQuantity = assetInfo.remainingQuantity.toNumber()
          metadata.itemType = assetInfo.itemType === 0 ? 'Medicine' : 'Equipment'
          
          console.log(`  ✓ Loaded: ${metadata.name} (${metadata.itemType})`);
          assets.push(metadata)
        } catch (error) {
          console.error(`  ❌ Error loading asset ${i}:`, error.message);
          console.error(`  URI was:`, uri);
          // Continue loading other assets even if one fails
        }
      }

      console.log('✅ All assets loaded:', assets.length);
      setAssets(assets)

      const escrow = new ethers.Contract(
        config[network.chainId].hospitalEscrow.address, 
        HospitalEscrow.abi || HospitalEscrow, 
        provider
      )
      setEscrow(escrow)
      
      // Get NEW hospital role addresses
      const adminAddress = await escrow.hospitalAdmin()
      setHospitalAdmin(adminAddress)
      
      const managerAddress = await escrow.storeManager()
      setStoreManager(managerAddress)

      window.ethereum.on('accountsChanged', async () => {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = ethers.utils.getAddress(accounts[0])
        setAccount(account);
        updateUserRole(account, adminAddress, managerAddress)
      })
    } catch (error) {
      console.error('❌ Error loading blockchain data:', error);
      alert('Error loading blockchain data. Make sure:\n1. MetaMask is installed\n2. Connected to Localhost 8545\n3. Hardhat node is running\n4. Contracts are deployed');
    }
  }

  const updateUserRole = (currentAccount, admin, manager) => {
    console.log('=== ROLE DETECTION DEBUG ===');
    console.log('Current Account:', currentAccount);
    console.log('Hospital Admin:', admin);
    console.log('Store Manager:', manager);
    
    if (currentAccount.toLowerCase() === admin.toLowerCase()) {
      console.log('✓ User is Hospital Admin');
      setUserRole('admin')
    } else if (currentAccount.toLowerCase() === manager.toLowerCase()) {
      console.log('✓ User is Store Manager');
      setUserRole('store')
    } else {
      console.log('✓ User is Ward Authority');
      setUserRole('ward')
    }
  }

  useEffect(() => {
    loadBlockchainData()
  }, [])

  useEffect(() => {
    if (account && hospitalAdmin && storeManager) {
      updateUserRole(account, hospitalAdmin, storeManager)
    }
  }, [account, hospitalAdmin, storeManager])

  const togglePop = (asset) => {
    setSelectedAsset(asset)
    toggle ? setToggle(false) : setToggle(true);
  }

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} userRole={userRole} />
      <Search />

      <div className='cards__section'>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Hospital Inventory - Medicines & Equipment</h3>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Hospital Authority (Admin) can add new assets */}
            {userRole === 'admin' && (
              <>
                <button 
                  onClick={() => setShowAddAsset(true)}
                  style={{
                    padding: '10px 20px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  + Add Medicine/Equipment
                </button>
                <button 
                  onClick={() => setShowHospitalProcurement(true)}
                  style={{
                    padding: '10px 20px',
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📦 View Procurement Requests
                </button>
              </>
            )}
            
            {/* Store Manager specific actions */}
            {userRole === 'store' && (
              <>
                <button 
                  onClick={() => setShowStoreManagerDashboard(true)}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📋 View Ward Requests
                </button>
                <button 
                  onClick={() => setShowRequestFromHospital(true)}
                  style={{
                    padding: '10px 20px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📦 Request Stock from Hospital
                </button>
              </>
            )}
          </div>
        </div>

        <hr />

        <div className='cards'>
          {assets.map((asset, index) => (
            <div className='card' key={index} onClick={() => togglePop(asset)}>
              <div className='card__info'>
                <h4>{asset.name}</h4>
                <p>
                  <strong>Type:</strong> {asset.itemType || asset.attributes?.find(a => a.trait_type === "Item Type")?.value || 'Medicine'}
                </p>
                <p>
                  <strong>Batch/Serial:</strong> {asset.attributes?.find(a => a.trait_type === "Batch ID" || a.trait_type === "Serial Number")?.value || 'N/A'}
                </p>
                <p>
                  <strong>Available:</strong> {asset.remainingQuantity} / {asset.totalQuantity} units
                </p>
                {asset.attributes?.find(a => a.trait_type === "Expiry Date") && (
                  <p>
                    <strong>Expiry:</strong> {asset.attributes.find(a => a.trait_type === "Expiry Date").value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {console.log('showAddAsset state:', showAddAsset)}
      {showAddAsset && (
        <>
          {console.log('Rendering AddMedicine component!')}
          <AddMedicine 
            provider={provider}
            account={account}
            medicalAsset={medicalAsset}
            onClose={() => {
              console.log('Closing AddMedicine modal');
              setShowAddAsset(false);
            }}
            onMedicineAdded={loadBlockchainData}
          />
        </>
      )}

      {toggle && (
        <Home 
          home={selectedAsset} 
          provider={provider} 
          account={account} 
          escrow={escrow} 
          medicalAsset={medicalAsset}
          togglePop={togglePop}
          userRole={userRole}
          hospitalAdmin={hospitalAdmin}
          storeManager={storeManager}
          onRequestComplete={loadBlockchainData}
        />
      )}

      {showStoreManagerDashboard && (
        <StoreManagerDashboard
          escrow={escrow}
          medicalAsset={medicalAsset}
          provider={provider}
          account={account}
          onClose={() => setShowStoreManagerDashboard(false)}
        />
      )}

      {showRequestFromHospital && (
        <RequestFromHospital
          provider={provider}
          account={account}
          escrow={escrow}
          onClose={() => setShowRequestFromHospital(false)}
        />
      )}

      {showHospitalProcurement && (
        <HospitalProcurementDashboard
          provider={provider}
          account={account}
          escrow={escrow}
          onClose={() => setShowHospitalProcurement(false)}
        />
      )}

    </div>
  );
}

export default App;
