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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 overflow-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-auto relative shadow-xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:text-slate-300">×</button>

                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Store Manager Dashboard</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">Issue medicines/equipment to wards and track your procurement requests</p>

                {loading && <p className="text-sm text-slate-500">Loading...</p>}

                {!showIssueForm ? (
                    <>
                        <section className="mb-8">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-3 border-b border-slate-100 dark:border-slate-700 pb-3">📦 My Procurement Requests</h3>

                            {procurementRequests.length === 0 ? (
                                <div className="p-4 text-center bg-slate-50 dark:bg-slate-700 rounded-md text-sm text-slate-500">No procurement requests yet</div>
                            ) : (
                                <div className="grid gap-3">
                                    {procurementRequests.map((request, index) => (
                                        <div key={index} className="border rounded-md p-4 bg-white dark:bg-slate-700 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{request.itemName}</h4>
                                                    <div className="flex gap-2 flex-wrap mb-2">
                                                        <span className="text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-700">{request.itemType.toUpperCase()}</span>
                                                        <span className="text-xs px-2 py-1 rounded-full" style={{background: request.statusColor, color: 'white'}}>{request.status}</span>
                                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">{request.urgency}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                                                        <div><strong>Quantity:</strong> {request.quantity} units</div>
                                                        <div><strong>Requested:</strong> {request.requestTimestamp}</div>
                                                        {request.approvedTimestamp && <div className="col-span-2"><strong>Processed:</strong> {request.approvedTimestamp}</div>}
                                                    </div>
                                                    {request.hospitalResponse && (
                                                        <div className={`mt-3 p-3 rounded-md ${request.isApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`} style={{borderLeft: `4px solid ${request.statusColor}`}}>
                                                            <strong className="text-sm text-slate-800">Hospital Response:</strong>
                                                            <p className="mt-1 text-sm text-slate-700">{request.hospitalResponse}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-3 border-b border-slate-100 dark:border-slate-700 pb-3">🏥 Ward Requests to Process</h3>

                            {wardRequests.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-700 rounded-md text-slate-500">
                                    <p className="text-lg">✓ No pending requests</p>
                                    <p className="text-sm">All ward requests have been processed</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {wardRequests.map((request, index) => (
                                        <div key={index} className={`border rounded-md p-4 ${request.storeApproved ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="text-md font-semibold text-slate-900">{request.assetName}</h3>
                                                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-2">
                                                        <div><strong>Type:</strong> {request.itemType}</div>
                                                        <div><strong>Requested By:</strong> {request.wardName}</div>
                                                        <div><strong>Patient ID:</strong> {request.patientId || 'N/A'}</div>
                                                        <div><strong>Quantity:</strong> {request.quantity} units</div>
                                                        <div><strong>Available:</strong> {request.availableQuantity} units</div>
                                                        <div><strong>Requested:</strong> {request.timestamp}</div>
                                                    </div>
                                                    {request.remarks && <p className="mt-2 text-sm text-slate-500"><strong>Remarks:</strong> {request.remarks}</p>}
                                                </div>

                                                <div className="flex flex-col gap-2 items-end">
                                                    {request.storeApproved ? (
                                                        <span className="px-3 py-1 rounded-md bg-emerald-500 text-white text-sm font-semibold">✓ You Approved</span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded-md bg-amber-500 text-white text-sm font-semibold">Pending Your Approval</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-3 mt-2">
                                                {!request.issued && (
                                                    <button onClick={() => handleIssueClick(request)} disabled={request.availableQuantity < request.quantity} className={`px-4 py-2 rounded-md text-white font-semibold ${request.availableQuantity >= request.quantity ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'}`}>
                                                        📦 Issue to Ward
                                                    </button>
                                                )}
                                                {request.availableQuantity < request.quantity && (
                                                    <span className="text-sm text-rose-600 self-center">⚠️ Insufficient stock - Request from Hospital Authority</span>
                                                )}
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
