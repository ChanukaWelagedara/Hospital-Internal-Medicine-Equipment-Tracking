import { useEffect, useState } from 'react';

const StoreManagerDashboard = ({ escrow, medicalAsset, provider, account, onClose }) => {
    const [wardRequests, setWardRequests] = useState([]);
    const [procurementRequests, setProcurementRequests] = useState([]);
    const [loading, setLoading] = useState(false);
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
            
            // Get all pending request IDs from the blockchain
            const pendingRequestIds = await escrow.getPendingRequests();
            console.log('Pending request IDs:', pendingRequestIds);
            
            const requests = [];
            for (let i = 0; i < pendingRequestIds.length; i++) {
                const requestId = pendingRequestIds[i].toNumber();
                const request = await escrow.issuanceRequests(requestId);
                
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
            
            // Get the request details to find the asset ID
            const request = await escrow.issuanceRequests(issueFormData.requestId);
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
            
            alert(`Successfully issued ${issueFormData.assetName} to ${issueFormData.wardName}!`);
            
            setShowIssueForm(false);
            loadWardRequests(); // Reload requests
        } catch (error) {
            console.error('Error issuing asset:', error);
            alert('Error issuing asset: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm overflow-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-7xl w-full max-h-[90vh] overflow-auto relative shadow-2xl animate-slide-up">
                <button 
                    onClick={onClose} 
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 text-2xl font-light"
                    title="Close"
                >
                    ×
                </button>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-medical-blue-500 to-medical-teal-500 rounded-xl shadow-medical">
                            <span className="text-3xl">📦</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Store Manager Dashboard</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Issue medicines/equipment to wards and track your procurement requests</p>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
                        <span className="animate-spin text-xl">⏳</span>
                        <span className="text-sm text-blue-700 font-medium">Loading data...</span>
                    </div>
                )}

                {!showIssueForm ? (
                    <>
                        {/* My Procurement Requests Section */}
                        <section className="mb-8">
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-medical-blue-200">
                                <span className="text-2xl">📦</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Procurement Requests</h3>
                                <span className="badge badge-info ml-auto">{procurementRequests.length}</span>
                            </div>

                            {procurementRequests.length === 0 ? (
                                <div className="card p-8 text-center">
                                    <div className="text-5xl mb-3">📊</div>
                                    <p className="text-slate-500 font-medium">No procurement requests yet</p>
                                    <p className="text-sm text-slate-400 mt-1">Your procurement requests will appear here</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {procurementRequests.map((request, index) => (
                                        <div key={index} className="card-medical p-5 hover:scale-[1.01] transition-transform duration-200">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                                                        <span>{request.itemType === 'medicine' ? '💊' : '🏥'}</span>
                                                        <span>{request.itemName}</span>
                                                    </h4>
                                                    <div className="flex gap-2 flex-wrap mb-3">
                                                        <span className="badge badge-info">{request.itemType.toUpperCase()}</span>
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

                        {/* Ward Requests Section */}
                        <section>
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-medical-teal-200">
                                <span className="text-2xl">🏥</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Ward Requests to Process</h3>
                                <span className="badge badge-warning ml-auto">{wardRequests.length}</span>
                            </div>

                            {wardRequests.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <div className="text-6xl mb-4">✅</div>
                                    <p className="text-lg font-semibold text-slate-700 mb-2">All Clear!</p>
                                    <p className="text-sm text-slate-500">No pending ward requests at the moment</p>
                                </div>
                            ) : (
                                <div className="grid gap-5">
                                    {wardRequests.map((request, index) => (
                                        <div key={index} className={`card-medical p-6 border-l-4 ${request.storeApproved ? 'border-emerald-500 bg-emerald-50/50' : 'border-amber-500 bg-amber-50/50'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <span className="text-2xl">{request.itemType === 'Medicine' ? '💊' : '🏥'}</span>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-900">{request.assetName}</h3>
                                                            <span className="badge badge-info text-xs">{request.itemType}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                                        <div className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                                                            <span>🏥</span>
                                                            <div>
                                                                <p className="text-xs text-slate-500">Ward</p>
                                                                <p className="text-sm font-semibold text-slate-800">{request.wardName}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                                                            <span>👤</span>
                                                            <div>
                                                                <p className="text-xs text-slate-500">Patient ID</p>
                                                                <p className="text-sm font-semibold text-slate-800">{request.patientId || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                                                            <span>🔢</span>
                                                            <div>
                                                                <p className="text-xs text-slate-500">Quantity</p>
                                                                <p className="text-sm font-semibold text-slate-800">{request.quantity} units</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                                                            <span>📦</span>
                                                            <div>
                                                                <p className="text-xs text-slate-500">Available Stock</p>
                                                                <p className={`text-sm font-bold ${request.availableQuantity >= request.quantity ? 'text-medical-green-600' : 'text-red-600'}`}>
                                                                    {request.availableQuantity} units
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm col-span-2">
                                                            <span>📅</span>
                                                            <div>
                                                                <p className="text-xs text-slate-500">Requested On</p>
                                                                <p className="text-sm font-semibold text-slate-800">{request.timestamp}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {request.remarks && (
                                                        <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400 mb-3">
                                                            <p className="text-xs text-blue-600 font-semibold mb-1">REMARKS</p>
                                                            <p className="text-sm text-slate-700">{request.remarks}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-2 items-end ml-4">
                                                    {request.storeApproved ? (
                                                        <span className="badge badge-success flex items-center gap-1">
                                                            <span>✅</span>
                                                            <span>You Approved</span>
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-warning flex items-center gap-1 animate-pulse">
                                                            <span>⏳</span>
                                                            <span>Pending Approval</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-200">
                                                {!request.issued && request.availableQuantity >= request.quantity ? (
                                                    <button 
                                                        onClick={() => handleIssueClick(request)} 
                                                        className="btn-primary flex items-center gap-2"
                                                    >
                                                        <span>📦</span>
                                                        <span>Issue to Ward</span>
                                                    </button>
                                                ) : !request.issued ? (
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg border border-red-200">
                                                        <span>⚠️</span>
                                                        <span className="text-sm font-semibold">Insufficient stock - Request from Hospital Authority</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                ) : (
                    <form onSubmit={handleIssueSubmit}>
                        <h3 className="text-lg font-medium mb-4">Issue Item to Ward</h3>

                        <div className="grid gap-3 mb-4">
                            <div>
                                <label className="block font-medium mb-1">Item</label>
                                <input type="text" value={issueFormData.assetName} disabled className="w-full px-3 py-2 border rounded-md bg-slate-50" />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Ward Name</label>
                                <input type="text" value={issueFormData.wardName} disabled className="w-full px-3 py-2 border rounded-md bg-slate-50" />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Patient ID</label>
                                <input type="text" value={issueFormData.patientId} onChange={(e) => setIssueFormData({...issueFormData, patientId: e.target.value})} required className="w-full px-3 py-2 border rounded-md" />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Quantity to Issue</label>
                                <input type="number" value={issueFormData.quantity} disabled className="w-full px-3 py-2 border rounded-md bg-slate-50" />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button type="submit" disabled={loading} className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold">{loading ? 'Issuing...' : 'Confirm Issue'}</button>
                            <button type="button" onClick={() => setShowIssueForm(false)} className="px-4 py-2 rounded-md bg-slate-600 text-white font-semibold">Cancel</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StoreManagerDashboard;
