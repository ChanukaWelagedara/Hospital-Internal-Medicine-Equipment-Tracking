import { ethers } from 'ethers';
import { useEffect, useState } from 'react';

// Components
import AddMedicine from './components/AddMedicine';
import Home from './components/Home';
import HospitalProcurementDashboard from './components/HospitalProcurementDashboard';
import Navigation from './components/Navigation';
import RequestFromHospital from './components/RequestFromHospital';
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
      <Navigation 
        account={account} 
        setAccount={setAccount} 
        userRole={userRole}
        medicalAsset={medicalAsset}
        escrow={escrow}
        provider={provider}
      />

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          
          {/* Page Header with Actions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
                  <span className="text-3xl">🏭</span>
                  <span>Hospital Inventory</span>
                </h3>
                <p className="text-sm text-slate-600">Medicines & Equipment Management System</p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {/* Hospital Authority (Admin) can add new assets */}
                {userRole === 'admin' && (
                  <>
                    <button 
                      onClick={() => setShowAddAsset(true)} 
                      className="btn-success flex items-center gap-2"
                    >
                      <span>➕</span>
                      <span>Add Asset</span>
                    </button>
                    <button 
                      onClick={() => setShowHospitalProcurement(true)} 
                      className="btn-primary flex items-center gap-2"
                    >
                      <span>📦</span>
                      <span>Procurement Requests</span>
                    </button>
                  </>
                )}
                
                {/* Store Manager specific actions */}
                {userRole === 'store' && (
                  <>
                    <button 
                      onClick={() => setShowStoreManagerDashboard(true)} 
                      className="btn-primary flex items-center gap-2"
                    >
                      <span>📋</span>
                      <span>Ward Requests</span>
                    </button>
                    <button 
                      onClick={() => setShowRequestFromHospital(true)} 
                      className="btn-secondary flex items-center gap-2"
                    >
                      <span>📝</span>
                      <span>Request Stock</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Assets Grid */}
          {assets.length === 0 ? (
            <div className="card p-16 text-center">
              <div className="text-7xl mb-4">🏭</div>
              <p className="text-xl font-semibold text-slate-700 mb-2">No Assets Yet</p>
              <p className="text-sm text-slate-500 mb-6">Start by adding medicines or equipment to your inventory</p>
              {userRole === 'admin' && (
                <button 
                  onClick={() => setShowAddAsset(true)} 
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <span>➕</span>
                  <span>Add First Asset</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {assets.map((asset, index) => {
                const expiryAttr = asset.attributes?.find(a => a.trait_type === "Expiry Date");
                const batchSerial = asset.attributes?.find(a => a.trait_type === "Batch ID" || a.trait_type === "Serial Number");
                const stockPercentage = (asset.remainingQuantity / asset.totalQuantity) * 100;
                const isLowStock = stockPercentage < 30;
                
                return (
                  <div 
                    key={index} 
                    onClick={() => togglePop(asset)} 
                    className="card-medical cursor-pointer group hover:scale-105 transition-all duration-300 overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-br from-medical-blue-500 to-medical-teal-500 p-4 -m-6 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-4xl">{asset.itemType === 'Medicine' ? '💊' : '🏥'}</span>
                        <span className={`badge ${isLowStock ? 'bg-amber-500' : 'bg-white/20'} text-white text-xs`}>
                          {isLowStock ? '⚠️ Low Stock' : '✅ In Stock'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Card Body */}
                    <div className="space-y-3">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-2 min-h-[3.5rem]">
                        {asset.name}
                      </h4>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="badge badge-info text-xs">{asset.itemType || 'Medicine'}</span>
                        </div>
                        
                        {batchSerial && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>🏷️</span>
                            <span className="font-mono text-xs">{batchSerial.value}</span>
                          </div>
                        )}
                        
                        {/* Stock Progress Bar */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-slate-600 font-semibold">Available Stock</span>
                            <span className="text-xs font-bold text-medical-blue-700">
                              {asset.remainingQuantity}/{asset.totalQuantity}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                stockPercentage > 50 ? 'bg-medical-green-500' :
                                stockPercentage > 30 ? 'bg-amber-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${stockPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {expiryAttr && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            <span>📅</span>
                            <span>Expires: <strong>{expiryAttr.value}</strong></span>
                          </div>
                        )}
                      </div>
                      
                      {/* View Details Button */}
                      <button className="w-full mt-4 py-2 bg-slate-100 hover:bg-medical-blue-100 text-medical-blue-700 rounded-lg font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2">
                        <span>👁️</span>
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
            escrow={escrow}
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
