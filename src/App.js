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
  const [activeTab, setActiveTab] = useState('medicines'); // 'medicines' or 'equipment'

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

      {/* Main Content with Professional Medical Background */}
      <div className="min-h-screen relative overflow-hidden">
        {/* Hero Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=1920&q=85')`,
            filter: 'brightness(1.15)'
          }}
        >
          {/* White Gradient Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/96 via-white/92 to-white/85"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-white/95"></div>
        </div>
        
        {/* Subtle Medical Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #0ea5e9 1px, transparent 1px),
              linear-gradient(to bottom, #0ea5e9 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        ></div>
        
        {/* Gradient Accent for Depth */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
        
        {/* Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          
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

          {/* Tab Navigation */}
          {assets.length > 0 && (
            <div className="flex gap-3 mb-8">
              <button
                onClick={() => setActiveTab('medicines')}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
                  activeTab === 'medicines'
                    ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-purple-600 text-white shadow-xl scale-105'
                    : 'bg-white text-slate-700 hover:bg-slate-50 shadow-md border border-slate-200'
                }`}
              >
                <span className="text-2xl">💊</span>
                <span className="text-lg">Medicines</span>
                <span className={`px-3 py-1 rounded-full text-sm font-extrabold ${
                  activeTab === 'medicines' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {assets.filter(a => a.itemType === 'Medicine').length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('equipment')}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
                  activeTab === 'equipment'
                    ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white shadow-xl scale-105'
                    : 'bg-white text-slate-700 hover:bg-slate-50 shadow-md border border-slate-200'
                }`}
              >
                <span className="text-2xl">🏥</span>
                <span className="text-lg">Medical Equipment</span>
                <span className={`px-3 py-1 rounded-full text-sm font-extrabold ${
                  activeTab === 'equipment' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {assets.filter(a => a.itemType === 'Equipment').length}
                </span>
              </button>
            </div>
          )}

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
            <>
              {/* Medicines Section */}
              {activeTab === 'medicines' && (() => {
                const medicines = assets.filter(asset => asset.itemType === 'Medicine');
                return medicines.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {medicines.map((asset, index) => {
                        const expiryAttr = asset.attributes?.find(a => a.trait_type === "Expiry Date");
                        const batchSerial = asset.attributes?.find(a => a.trait_type === "Batch ID" || a.trait_type === "Serial Number");
                        const stockPercentage = (asset.remainingQuantity / asset.totalQuantity) * 100;
                        const isLowStock = stockPercentage < 30;
                        
                        const isOutOfStock = asset.remainingQuantity === 0;
                        const stockColor = isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-500' : 'text-green-600';
                        
                        return (
                          <div 
                            key={index} 
                            className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border-t-[5px] border-blue-600"
                          >
                            {/* Number Badge */}
                            <div className="absolute top-5 left-5 w-11 h-11 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-slate-500 font-bold text-sm">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                            </div>
                            
                            {/* Card Content */}
                            <div className="p-8 pt-10 flex flex-col items-center text-center">
                              {/* Icon - Pill Bottle for Medicine */}
                              <div className="mb-6 mt-4">
                                <svg className="w-24 h-24 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              
                              {/* Title */}
                              <h4 className="text-xl font-bold text-slate-800 mb-4 min-h-[3rem] line-clamp-2">
                                {asset.name}
                              </h4>
                              
                              {/* Description/Details */}
                              <div className="text-sm text-slate-600 space-y-2.5 mb-6 w-full">
                                <p className="flex items-center justify-center gap-2">
                                  <span className="font-semibold text-slate-500">Stock:</span>
                                  <span className={`font-bold text-base ${stockColor}`}>
                                    {asset.remainingQuantity}/{asset.totalQuantity}
                                  </span>
                                </p>
                                
                                {batchSerial && (
                                  <p className="text-xs font-mono text-slate-400">
                                    Batch: {batchSerial.value}
                                  </p>
                                )}
                                
                                {expiryAttr && (
                                  <p className="text-xs text-amber-600 font-semibold">
                                    Exp: {expiryAttr.value}
                                  </p>
                                )}
                                
                                {isLowStock && !isOutOfStock && (
                                  <div className="flex items-center justify-center gap-1.5 text-orange-600 font-semibold text-xs mt-3">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Low Stock</span>
                                  </div>
                                )}
                                
                                {isOutOfStock && (
                                  <div className="flex items-center justify-center gap-1.5 text-red-600 font-semibold text-xs mt-3">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span>Out of Stock</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Action Button */}
                              <button 
                                onClick={() => togglePop(asset)}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="card p-16 text-center">
                    <div className="text-7xl mb-4">💊</div>
                    <p className="text-xl font-semibold text-slate-700 mb-2">No Medicines Yet</p>
                    <p className="text-sm text-slate-500">Add medicines to your inventory</p>
                  </div>
                );
              })()}

              {/* Equipment Section */}
              {activeTab === 'equipment' && (() => {
                const equipment = assets.filter(asset => asset.itemType === 'Equipment');
                return equipment.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {equipment.map((asset, index) => {
                        const expiryAttr = asset.attributes?.find(a => a.trait_type === "Expiry Date");
                        const batchSerial = asset.attributes?.find(a => a.trait_type === "Batch ID" || a.trait_type === "Serial Number");
                        const stockPercentage = (asset.remainingQuantity / asset.totalQuantity) * 100;
                        const isLowStock = stockPercentage < 30;
                        
                        const isOutOfStock = asset.remainingQuantity === 0;
                        const stockColor = isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-500' : 'text-green-600';
                        
                        return (
                          <div 
                            key={index} 
                            className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border-t-[5px] border-blue-600"
                          >
                            {/* Number Badge */}
                            <div className="absolute top-5 left-5 w-11 h-11 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-slate-500 font-bold text-sm">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                            </div>
                            
                            {/* Card Content */}
                            <div className="p-8 pt-10 flex flex-col items-center text-center">
                              {/* Icon - Medical Equipment */}
                              <div className="mb-6 mt-4">
                                <svg className="w-24 h-24 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                              </div>
                              
                              {/* Title */}
                              <h4 className="text-xl font-bold text-slate-800 mb-4 min-h-[3rem] line-clamp-2">
                                {asset.name}
                              </h4>
                              
                              {/* Description/Details */}
                              <div className="text-sm text-slate-600 space-y-2.5 mb-6 w-full">
                                <p className="flex items-center justify-center gap-2">
                                  <span className="font-semibold text-slate-500">Stock:</span>
                                  <span className={`font-bold text-base ${stockColor}`}>
                                    {asset.remainingQuantity}/{asset.totalQuantity}
                                  </span>
                                </p>
                                
                                {batchSerial && (
                                  <p className="text-xs font-mono text-slate-400">
                                    Serial: {batchSerial.value}
                                  </p>
                                )}
                                
                                {expiryAttr && (
                                  <p className="text-xs text-amber-600 font-semibold">
                                    Exp: {expiryAttr.value}
                                  </p>
                                )}
                                
                                {isLowStock && !isOutOfStock && (
                                  <div className="flex items-center justify-center gap-1.5 text-orange-600 font-semibold text-xs mt-3">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Low Stock</span>
                                  </div>
                                )}
                                
                                {isOutOfStock && (
                                  <div className="flex items-center justify-center gap-1.5 text-red-600 font-semibold text-xs mt-3">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span>Out of Stock</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Action Button */}
                              <button 
                                onClick={() => togglePop(asset)}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="card p-16 text-center">
                    <div className="text-7xl mb-4">🏥</div>
                    <p className="text-xl font-semibold text-slate-700 mb-2">No Equipment Yet</p>
                    <p className="text-sm text-slate-500">Add medical equipment to your inventory</p>
                  </div>
                );
              })()}
            </>
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
