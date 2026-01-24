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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          
          {/* Hero Section with Stats */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl overflow-hidden">
              <div className="relative px-8 py-10">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full -mr-32 -mt-32 opacity-20"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-800 rounded-full -ml-24 -mb-24 opacity-20"></div>
                
                <div className="relative z-10">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Hospital Inventory</h1>
                        <p className="text-blue-100">Comprehensive Medical Asset Management System</p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      {/* Hospital Authority (Admin) can add new assets */}
                      {userRole === 'admin' && (
                        <>
                          <button 
                            onClick={() => setShowAddAsset(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Add Asset</span>
                          </button>
                          <button 
                            onClick={() => setShowHospitalProcurement(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-400 shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <span>Procurement Requests</span>
                          </button>
                        </>
                      )}
                      
                      {/* Store Manager specific actions */}
                      {userRole === 'store' && (
                        <>
                          <button 
                            onClick={() => setShowStoreManagerDashboard(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>Ward Requests</span>
                          </button>
                          <button 
                            onClick={() => setShowRequestFromHospital(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-400 shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Request Stock</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          {assets.length > 0 && (
            <div className="flex gap-3 mb-8">
              <button
                onClick={() => setActiveTab('medicines')}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 ${ 
                  activeTab === 'medicines'
                    ? 'bg-white text-blue-700 shadow-lg border-2 border-blue-500'
                    : 'bg-white/80 text-slate-600 hover:bg-white hover:shadow-md border border-slate-200'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-lg">Medicines</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  activeTab === 'medicines' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {assets.filter(a => a.itemType === 'Medicine').length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('equipment')}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 ${
                  activeTab === 'equipment'
                    ? 'bg-white text-blue-700 shadow-lg border-2 border-blue-500'
                    : 'bg-white/80 text-slate-600 hover:bg-white hover:shadow-md border border-slate-200'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span className="text-lg">Medical Equipment</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  activeTab === 'equipment' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {assets.filter(a => a.itemType === 'Equipment').length}
                </span>
              </button>
            </div>
          )}

          {/* Assets Grid */}
          {assets.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-16 text-center border border-slate-200">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-slate-800 mb-2">No Assets Yet</p>
              <p className="text-slate-500 mb-6">Start by adding medicines or equipment to your inventory</p>
              {userRole === 'admin' && (
                <button 
                  onClick={() => setShowAddAsset(true)} 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
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
                                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                                    <span className="text-xs text-slate-500">Batch</span>
                                    <span className="text-xs font-mono text-slate-700">{batchSerial.value}</span>
                                  </div>
                                )}
                                
                                {expiryAttr && (
                                  <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg">
                                    <span className="text-xs text-amber-600 font-medium">Expiry</span>
                                    <span className="text-xs text-amber-700 font-medium">{expiryAttr.value}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Action Button */}
                              <button 
                                onClick={() => togglePop(asset)}
                                className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
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
                  <div className="bg-white rounded-2xl shadow-md p-12 text-center border border-slate-200">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <p className="text-xl font-bold text-slate-800 mb-1">No Medicines Yet</p>
                    <p className="text-slate-500">Add medicines to your inventory</p>
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
                            className="relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-200 hover:border-blue-300"
                          >
                            {/* Status Badge */}
                            {(isLowStock || isOutOfStock) && (
                              <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold ${
                                isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                              </div>
                            )}
                            
                            {/* Card Content */}
                            <div className="p-6 flex flex-col items-center text-center">
                              {/* Icon - Medical Equipment */}
                              <div className="mb-4 w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center">
                                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                              </div>
                              
                              {/* Title */}
                              <h4 className="text-lg font-bold text-slate-800 mb-3 line-clamp-2">
                                {asset.name}
                              </h4>
                              
                              {/* Description/Details */}
                              <div className="text-sm text-slate-600 space-y-2 mb-5 w-full">
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                                  <span className="font-medium text-slate-500">Stock</span>
                                  <span className={`font-bold ${stockColor}`}>
                                    {asset.remainingQuantity}/{asset.totalQuantity}
                                  </span>
                                </div>
                                
                                {batchSerial && (
                                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                                    <span className="text-xs text-slate-500">Serial</span>
                                    <span className="text-xs font-mono text-slate-700">{batchSerial.value}</span>
                                  </div>
                                )}
                                
                                {expiryAttr && (
                                  <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg">
                                    <span className="text-xs text-amber-600 font-medium">Expiry</span>
                                    <span className="text-xs text-amber-700 font-medium">{expiryAttr.value}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Action Button */}
                              <button 
                                onClick={() => togglePop(asset)}
                                className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
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
                  <div className="bg-white rounded-2xl shadow-md p-12 text-center border border-slate-200">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <p className="text-xl font-bold text-slate-800 mb-1">No Equipment Yet</p>
                    <p className="text-slate-500">Add medical equipment to your inventory</p>
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
