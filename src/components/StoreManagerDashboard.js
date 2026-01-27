import { useEffect, useState } from 'react';

const StoreManagerDashboard = ({ escrow, medicalAsset, provider, account, onClose }) => {
    const [wardRequests, setWardRequests] = useState([]);
    const [procurementRequests, setProcurementRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState('ward'); // 'ward' or 'procurement'
    const [wardRequestFilter, setWardRequestFilter] = useState('pending'); // 'pending', 'completed', 'all'
    const [issueFormData, setIssueFormData] = useState({
        requestId: null,
        wardName: '',
        patientId: '',
        quantity: '',
        assetName: ''
    });
    const [showIssueForm, setShowIssueForm] = useState(false);

    useEffect(() => {
        loadWardRequests();
        loadProcurementRequests();
    }, [escrow]);

    const loadProcurementRequests = async () => {
        try {
            console.log('Loading procurement requests for Store Manager...');
            
            // Get all procurement requests made by this store manager
            const requestIds = await escrow.getStoreManagerProcurementRequests(account);
            console.log('Store Manager procurement request IDs:', requestIds);
            
            const requests = [];
            for (let i = 0; i < requestIds.length; i++) {
                const requestId = requestIds[i].toNumber();
                const request = await escrow.getProcurementRequest(requestId);
                
                let status = 'Pending';
                let statusColor = '#f59e0b';
                if (request.isApproved) {
                    status = 'Approved';
                    statusColor = '#16a34a';
                } else if (request.isRejected) {
                    status = 'Rejected';
                    statusColor = '#dc2626';
                }
                
                requests.push({
                    requestId,
                    itemName: request.itemName,
                    itemType: request.itemType,
                    quantity: request.quantity.toNumber(),
                    reason: request.reason,
                    urgency: request.urgency,
                    additionalNotes: request.additionalNotes,
                    requestTimestamp: new Date(request.requestTimestamp.toNumber() * 1000).toLocaleString(),
                    approvedTimestamp: request.approvedTimestamp.toNumber() > 0 
                        ? new Date(request.approvedTimestamp.toNumber() * 1000).toLocaleString() 
                        : null,
                    isPending: request.isPending,
                    isApproved: request.isApproved,
                    isRejected: request.isRejected,
                    hospitalResponse: request.hospitalResponse,
                    status,
                    statusColor
                });
            }
            
            // Sort by most recent first
            requests.sort((a, b) => b.requestId - a.requestId);
            
            setProcurementRequests(requests);
            console.log('Loaded procurement requests:', requests.length);
        } catch (error) {
            console.error('Error loading procurement requests:', error);
        }
    };

    const loadWardRequests = async () => {
        try {
            setLoading(true);
            console.log('Loading ward requests...');
            
            // Get request counter to load all requests
            const requestCounter = await escrow.requestCounter();
            console.log('Total requests:', requestCounter.toNumber());
            
            const requests = [];
            for (let i = 1; i <= requestCounter.toNumber(); i++) {
                const request = await escrow.issuanceRequests(i);
                const requestId = i;
                
                // Get asset details
                const assetInfo = await medicalAsset.getAssetInfo(request.assetId.toNumber());
                const uri = await medicalAsset.tokenURI(request.assetId.toNumber());
                
                let assetName = `Asset #${request.assetId.toNumber()}`;
                try {
                    if (uri.startsWith('data:application/json')) {
                        const base64Data = uri.split(',')[1];
                        const metadata = JSON.parse(atob(base64Data));
                        assetName = metadata.name;
                    } else {
                        // Try to fetch HTTP URL
                        const response = await fetch(uri);
                        if (response.ok) {
                            const metadata = await response.json();
                            assetName = metadata.name;
                        }
                    }
                } catch (e) {
                    console.error('Error parsing metadata:', e);
                }
                
                const isPending = request.isPending;
                const isCompleted = request.isIssued;
                
                requests.push({
                    requestId,
                    assetId: request.assetId.toNumber(),
                    assetName,
                    wardName: request.wardName,
                    patientId: request.patientId,
                    quantity: request.requestedQuantity.toNumber(),
                    remarks: request.remarks,
                    requestedBy: request.wardAuthority,
                    storeApproved: request.storeApproved,
                    adminApproved: request.adminApproved,
                    issued: request.isIssued,
                    isPending: isPending,
                    isCompleted: isCompleted,
                    timestamp: new Date(request.requestTimestamp.toNumber() * 1000).toLocaleString(),
                    itemType: assetInfo.itemType === 0 ? 'Medicine' : 'Equipment',
                    availableQuantity: assetInfo.remainingQuantity.toNumber()
                });
            }
            
            setWardRequests(requests);
            console.log('Loaded requests:', requests.length);
        } catch (error) {
            console.error('Error loading ward requests:', error);
            alert('Error loading ward requests: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleIssueClick = (request) => {
        // Validate request is still pending before allowing issue
        if (!request.isPending || request.isCompleted || request.storeApproved) {
            alert('This request has already been processed and cannot be issued again.');
            return;
        }
        
        setIssueFormData({
            requestId: request.requestId,
            wardName: request.wardName,
            patientId: request.patientId,
            quantity: request.quantity,
            assetName: request.assetName,
            assetId: request.assetId
        });
        setShowIssueForm(true);
    };

    const handleIssueSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const signer = await provider.getSigner();
            
            console.log(`Issuing asset ${issueFormData.assetName} to ${issueFormData.wardName}...`);
            
            // Get the request details to find the asset ID and verify it's still pending
            const request = await escrow.issuanceRequests(issueFormData.requestId);
            
            // Double-check the request is still pending on the blockchain
            if (!request.isPending) {
                alert('This request is no longer pending. It may have already been processed.');
                setShowIssueForm(false);
                loadWardRequests(); // Refresh to get latest state
                setLoading(false);
                return;
            }
            
            if (request.isIssued) {
                alert('This asset has already been issued.');
                setShowIssueForm(false);
                loadWardRequests(); // Refresh to get latest state
                setLoading(false);
                return;
            }
            
            const assetId = request.assetId.toNumber();
            
            // Get the owner of the asset
            const assetOwner = await medicalAsset.ownerOf(assetId);
            console.log('Asset owner:', assetOwner);
            console.log('Current account:', account);
            
            // Check if escrow contract is approved by the asset owner
            const isApproved = await medicalAsset.isApprovedForAll(assetOwner, escrow.address);
            console.log('Is escrow approved?', isApproved);
            
            if (!isApproved) {
                // If current account is the owner, approve it
                if (assetOwner.toLowerCase() === account.toLowerCase()) {
                    console.log('Approving escrow contract to manage assets...');
                    const approvalTx = await medicalAsset.connect(signer).setApprovalForAll(escrow.address, true);
                    await approvalTx.wait();
                    console.log('Escrow contract approved successfully');
                } else {
                    // Owner needs to approve first
                    alert(`The asset owner (${assetOwner.substring(0, 8)}...${assetOwner.substring(38)}) needs to approve the escrow contract first. Please switch to that account and approve, or contact them.`);
                    setLoading(false);
                    return;
                }
            }
            
            // Call the issueAsset function - only needs requestId
            const transaction = await escrow.connect(signer).issueAsset(
                issueFormData.requestId
            );
            
            await transaction.wait();
            
            // Update the local state immediately to reflect the new stock
            setWardRequests(prevRequests => 
                prevRequests.map(req => {
                    if (req.requestId === issueFormData.requestId) {
                        return {
                            ...req,
                            availableQuantity: req.availableQuantity - req.quantity,
                            storeApproved: true,
                            isCompleted: true,
                            isPending: false
                        };
                    }
                    return req;
                })
            );
            
            alert(`Successfully issued ${issueFormData.assetName} to ${issueFormData.wardName}!`);
            
            setShowIssueForm(false);
            
            // Also reload in the background to ensure blockchain sync
            loadWardRequests();
        } catch (error) {
            console.error('Error issuing asset:', error);
            alert('Error issuing asset: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
            <div className="flex">
                {/* Sidebar */}
                <div className="w-64 bg-white border-r border-slate-200 min-h-screen fixed left-0 top-0 shadow-sm">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Store Manager</h3>
                                <p className="text-xs text-slate-500">Dashboard</p>
                            </div>
                        </div>

                        <nav className="space-y-2">
                            <button 
                                onClick={() => setActiveSection('ward')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${
                                    activeSection === 'ward' 
                                        ? 'bg-blue-50 text-blue-700' 
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span>Ward Requests</span>
                            </button>
                            <button 
                                onClick={() => setActiveSection('procurement')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${
                                    activeSection === 'procurement' 
                                        ? 'bg-blue-50 text-blue-700' 
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <span>My Procurement</span>
                            </button>
                            <button 
                                onClick={onClose}
                                className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-lg font-medium mt-4"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span>Back to Inventory</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Main Content */}
                <div className="ml-64 flex-1">
                    {/* Top Header */}
                    <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {activeSection === 'ward' ? 'Store Manager Dashboard' : 'My Procurement Requests'}
                                </h1>
                                <p className="text-sm text-slate-600">
                                    {activeSection === 'ward' 
                                        ? 'Issue medicines/equipment to wards and track procurement'
                                        : 'View and track your procurement requests to hospital authority'
                                    }
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {loading && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                                        <span className="animate-spin text-lg">⏳</span>
                                        <span className="text-sm text-blue-700 font-medium">Loading...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Dashboard Content */}
                    <div className="p-8">
                        {/* Stats Cards - Show only for Ward Requests section */}
                        {activeSection === 'ward' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600 font-medium">Pending Requests</p>
                                            <p className="text-3xl font-bold text-slate-900 mt-2">
                                                {wardRequests.filter(r => r.isPending).length}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600 font-medium">Completed</p>
                                            <p className="text-3xl font-bold text-slate-900 mt-2">
                                                {wardRequests.filter(r => r.isCompleted).length}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600 font-medium">My Procurement</p>
                                            <p className="text-3xl font-bold text-slate-900 mt-2">{procurementRequests.length}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!showIssueForm ? (
                            <>
                                {/* My Procurement Requests Section */}
                                {activeSection === 'procurement' && (
                                    <section>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xl font-bold text-slate-900">My Procurement Requests</h3>
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                                                {procurementRequests.length} Total
                                            </span>
                                        </div>

                                        {procurementRequests.length === 0 ? (
                                            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                                <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                    </svg>
                                                </div>
                                                <p className="text-slate-600 font-medium">No procurement requests yet</p>
                                                <p className="text-sm text-slate-400 mt-1">Your procurement requests will appear here</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-4">
                                                {procurementRequests.map((request, index) => (
                                                    <div key={index} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-all duration-200">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex items-start gap-4 flex-1">
                                                                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        {request.itemType === 'Medicine' ? (
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                                        ) : (
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                                        )}
                                                                    </svg>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="text-lg font-bold text-slate-900 mb-1">{request.itemName}</h4>
                                                                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-3">
                                                                        {request.itemType}
                                                                    </span>
                                                                    <span className={`badge ${request.isApproved ? 'badge-success' : request.isRejected ? 'badge-danger' : 'badge-warning'}`}>
                                                                        {request.isApproved ? '✅ Approved' : request.isRejected ? '❌ Rejected' : '⏳ Pending'}
                                                                    </span>
                                                                    <span 
                                                                        className="badge" 
                                                                        style={{
                                                                            background: request.urgency === 'critical' ? '#dc2626' : request.urgency === 'high' ? '#ea580c' : request.urgency === 'normal' ? '#2563eb' : '#16a34a',
                                                                            color: 'white'
                                                                        }}
                                                                    >
                                                                        {request.urgency === 'critical' ? '🔴' : request.urgency === 'high' ? '🟠' : request.urgency === 'low' ? '🟢' : '🔵'} {request.urgency.toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                                                <span>🔢</span>
                                                                <div>
                                                                    <p className="text-xs text-slate-500">Quantity</p>
                                                                    <p className="text-sm font-semibold text-slate-800">{request.quantity} units</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                                                <span>📅</span>
                                                                <div>
                                                                    <p className="text-xs text-slate-500">Requested</p>
                                                                    <p className="text-sm font-semibold text-slate-800">{request.requestTimestamp}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {request.hospitalResponse && (
                                                            <div className={`mt-3 p-4 rounded-lg border-l-4 ${request.isApproved ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-rose-500'}`}>
                                                                <p className="text-xs font-bold text-slate-600 uppercase mb-1">Hospital Response</p>
                                                                <p className="text-sm text-slate-700">{request.hospitalResponse}</p>
                                                                {request.approvedTimestamp && (
                                                                    <p className="text-xs text-slate-500 mt-2">Processed: {request.approvedTimestamp}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* Ward Requests Section */}
                                {activeSection === 'ward' && (
                                    <section>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xl font-bold text-slate-900">Ward Requests</h3>
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                                                {wardRequests.length} Total
                                            </span>
                                        </div>

                                        {/* Filter Tabs */}
                                        <div className="flex gap-3 mb-6">
                                            <button
                                                onClick={() => setWardRequestFilter('pending')}
                                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                                    wardRequestFilter === 'pending'
                                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                                }`}
                                            >
                                                Pending ({wardRequests.filter(r => r.isPending).length})
                                            </button>
                                            <button
                                                onClick={() => setWardRequestFilter('completed')}
                                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                                    wardRequestFilter === 'completed'
                                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                                }`}
                                            >
                                                Completed ({wardRequests.filter(r => r.isCompleted).length})
                                            </button>
                                            <button
                                                onClick={() => setWardRequestFilter('all')}
                                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                                    wardRequestFilter === 'all'
                                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                                }`}
                                            >
                                                All ({wardRequests.length})
                                            </button>
                                        </div>

                                        {(() => {
                                            const filteredRequests = wardRequests.filter(request => {
                                                if (wardRequestFilter === 'pending') return request.isPending;
                                                if (wardRequestFilter === 'completed') return request.isCompleted;
                                                return true; // 'all'
                                            });

                                            return filteredRequests.length === 0 ? (
                                                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                                                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-slate-600 font-medium">
                                                        {wardRequestFilter === 'pending' ? 'All Clear!' : 
                                                         wardRequestFilter === 'completed' ? 'No Completed Requests' : 
                                                         'No Requests Yet'}
                                                    </p>
                                                    <p className="text-sm text-slate-400 mt-1">
                                                        {wardRequestFilter === 'pending' ? 'No pending ward requests at the moment' :
                                                         wardRequestFilter === 'completed' ? 'No ward requests have been completed yet' :
                                                         'No ward requests in the system'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="grid gap-5">
                                                    {filteredRequests.map((request, index) => {
                                                        const stockPercentage = (request.availableQuantity / (request.availableQuantity + request.quantity)) * 100;
                                                        const isLowStock = request.availableQuantity < request.quantity;
                                                        const isCriticalStock = request.availableQuantity < (request.quantity * 0.5);
                                                        
                                                        return (
                                                            <div key={index} className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-blue-300">
                                                                {/* Status Header */}
                                                                <div className={`px-6 py-3 border-b-2 ${
                                                                    request.storeApproved 
                                                                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200' 
                                                                        : isLowStock 
                                                                            ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200'
                                                                            : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
                                                                }`}>
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                                                request.storeApproved 
                                                                                    ? 'bg-emerald-500' 
                                                                                    : isLowStock 
                                                                                        ? 'bg-amber-500'
                                                                                        : 'bg-blue-500'
                                                                            }`}>
                                                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    {request.itemType === 'Medicine' ? (
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                                                    ) : (
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                                                    )}
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="text-lg font-bold text-slate-900">{request.assetName}</h3>
                                                                                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                                                                                    request.itemType === 'Medicine' 
                                                                                        ? 'bg-blue-200 text-blue-800'
                                                                                        : 'bg-purple-200 text-purple-800'
                                                                                }`}>
                                                                                    {request.itemType}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {request.storeApproved ? (
                                                                                <span className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-md">
                                                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    ISSUED
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-md animate-pulse">
                                                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    PENDING
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Main Content */}
                                                                <div className="p-6">
                                                                    {/* Stock Flow Visualization */}
                                                                    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-5 mb-5 border-2 border-blue-100">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Medicine Stock Flow</h4>
                                                                            {isCriticalStock && (
                                                                                <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse flex items-center gap-1">
                                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    CRITICAL
                                                                                </span>
                                                                            )}
                                                                            {isLowStock && !isCriticalStock && (
                                                                                <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    LOW STOCK
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Stock Numbers */}
                                                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                                                            <div className="bg-white rounded-lg p-4 border-2 border-blue-200 text-center">
                                                                                <p className="text-xs text-blue-600 font-bold mb-1">AVAILABLE</p>
                                                                                <p className={`text-2xl font-black ${
                                                                                    isCriticalStock ? 'text-red-600' : 
                                                                                    isLowStock ? 'text-amber-600' : 
                                                                                    'text-blue-600'
                                                                                }`}>
                                                                                    {request.availableQuantity}
                                                                                </p>
                                                                                <p className="text-xs text-slate-500">units</p>
                                                                            </div>
                                                                            <div className="bg-white rounded-lg p-4 border-2 border-amber-200 text-center">
                                                                                <p className="text-xs text-amber-600 font-bold mb-1">REQUESTED</p>
                                                                                <p className="text-2xl font-black text-amber-600">{request.quantity}</p>
                                                                                <p className="text-xs text-slate-500">units</p>
                                                                            </div>
                                                                            <div className="bg-white rounded-lg p-4 border-2 border-emerald-200 text-center">
                                                                                <p className="text-xs text-emerald-600 font-bold mb-1">REMAINING</p>
                                                                                <p className="text-2xl font-black text-emerald-600">
                                                                                    {Math.max(0, request.availableQuantity - request.quantity)}
                                                                                </p>
                                                                                <p className="text-xs text-slate-500">after issue</p>
                                                                            </div>
                                                                        </div>

                                                                        {/* Progress Bar */}
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                                                                                <span>Stock Level</span>
                                                                                <span>{stockPercentage.toFixed(0)}% Available</span>
                                                                            </div>
                                                                            <div className="h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                                                                <div 
                                                                                    className={`h-full transition-all duration-500 ${
                                                                                        isCriticalStock ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                                                                        isLowStock ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                                                                        'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                                                                    }`}
                                                                                    style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                                                                                ></div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Request Details Grid */}
                                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                                                            <div className="w-8 h-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-slate-500">Ward</p>
                                                                                <p className="text-sm font-semibold text-slate-800">{request.wardName}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-slate-500">Patient ID</p>
                                                                                <p className="text-sm font-semibold text-slate-800">{request.patientId || 'N/A'}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                                                            <div className="w-8 h-8 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-slate-500">Quantity</p>
                                                                                <p className="text-sm font-semibold text-slate-800">{request.quantity} units</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                                                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-slate-500">Available Stock</p>
                                                                                <p className={`text-sm font-bold ${request.availableQuantity >= request.quantity ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                                    {request.availableQuantity} units
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 col-span-2">
                                                                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                                <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-slate-500">Requested On</p>
                                                                                <p className="text-sm font-semibold text-slate-800">{request.timestamp}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                            
                                                                    {request.remarks && (
                                                                        <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 mb-4">
                                                                            <p className="text-xs text-blue-600 font-semibold mb-1">REMARKS</p>
                                                                            <p className="text-sm text-slate-700">{request.remarks}</p>
                                                                        </div>
                                                                    )}

                                                                    {!request.storeApproved && !request.isCompleted && request.isPending && request.availableQuantity >= request.quantity && (
                                                                        <div className="flex gap-3">
                                                                            <button
                                                                                onClick={() => handleIssueClick(request)}
                                                                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                                                            >
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                </svg>
                                                                                Issue Asset
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {(request.storeApproved || request.isCompleted || !request.isPending) && (
                                                                        <div className="p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500 flex items-center gap-3">
                                                                            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                            </svg>
                                                                            <p className="text-sm font-semibold text-emerald-700">
                                                                                ✅ Asset has been issued successfully
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {request.availableQuantity < request.quantity && (
                                                                        <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500 flex items-center gap-3">
                                                                            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                                            </svg>
                                                                            <p className="text-sm font-semibold text-red-700">
                                                                                Insufficient stock! Available: {request.availableQuantity} units | Requested: {request.quantity} units
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </section>
                                )}
                            </>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl mx-auto">
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Issue Item to Ward</h3>
                                    </div>
                                </div>

                                <form onSubmit={handleIssueSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Item Name</label>
                                        <input 
                                            type="text" 
                                            value={issueFormData.assetName} 
                                            disabled 
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Ward Name</label>
                                        <input 
                                            type="text" 
                                            value={issueFormData.wardName} 
                                            disabled 
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Patient ID</label>
                                        <input 
                                            type="text" 
                                            value={issueFormData.patientId} 
                                            onChange={(e) => setIssueFormData({...issueFormData, patientId: e.target.value})} 
                                            required 
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter patient ID"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Quantity to Issue</label>
                                        <input 
                                            type="number" 
                                            value={issueFormData.quantity} 
                                            disabled 
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 font-medium"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button 
                                            type="submit" 
                                            disabled={loading} 
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span>Issuing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>Confirm Issue</span>
                                                </>
                                            )}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowIssueForm(false)} 
                                            className="px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-all duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoreManagerDashboard;
