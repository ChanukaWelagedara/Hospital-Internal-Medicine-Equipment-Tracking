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
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            overflowY: 'auto',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '10px',
                padding: '30px',
                maxWidth: '1000px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                position: 'relative'
            }}>
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'none',
                        border: 'none',
                        fontSize: '30px',
                        cursor: 'pointer',
                        color: '#666'
                    }}
                >
                    ×
                </button>

                <h2 style={{ marginBottom: '10px', color: '#333' }}>
                    Store Manager Dashboard
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '25px' }}>
                    Issue medicines/equipment to wards and track your procurement requests
                </p>

                {loading && <p>Loading...</p>}

                {!showIssueForm ? (
                    <>
                        {/* My Procurement Requests Section */}
                        <div style={{ marginBottom: '30px' }}>
                            <h3 style={{ 
                                fontSize: '18px', 
                                color: '#333', 
                                marginBottom: '15px',
                                paddingBottom: '10px',
                                borderBottom: '2px solid #e5e7eb'
                            }}>
                                📦 My Procurement Requests
                            </h3>
                            
                            {procurementRequests.length === 0 ? (
                                <div style={{ 
                                    padding: '20px', 
                                    textAlign: 'center', 
                                    background: '#f9fafb', 
                                    borderRadius: '8px',
                                    color: '#6b7280'
                                }}>
                                    <p style={{ fontSize: '14px' }}>No procurement requests yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {procurementRequests.map((request, index) => (
                                        <div key={index} style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '15px',
                                            background: 'white',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '16px' }}>
                                                        {request.itemName}
                                                    </h4>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                        <span style={{ 
                                                            padding: '3px 8px', 
                                                            background: '#dbeafe', 
                                                            color: '#1e40af',
                                                            borderRadius: '10px',
                                                            fontSize: '11px',
                                                            fontWeight: '500'
                                                        }}>
                                                            {request.itemType.toUpperCase()}
                                                        </span>
                                                        <span style={{ 
                                                            padding: '3px 8px', 
                                                            background: request.statusColor,
                                                            color: 'white',
                                                            borderRadius: '10px',
                                                            fontSize: '11px',
                                                            fontWeight: '600'
                                                        }}>
                                                            {request.status}
                                                        </span>
                                                        <span style={{ 
                                                            padding: '3px 8px', 
                                                            background: '#fef3c7', 
                                                            color: '#92400e',
                                                            borderRadius: '10px',
                                                            fontSize: '11px'
                                                        }}>
                                                            {request.urgency}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#6b7280', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
                                                        <p style={{ margin: 0 }}><strong>Quantity:</strong> {request.quantity} units</p>
                                                        <p style={{ margin: 0 }}><strong>Requested:</strong> {request.requestTimestamp}</p>
                                                        {request.approvedTimestamp && (
                                                            <p style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                                <strong>Processed:</strong> {request.approvedTimestamp}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {request.hospitalResponse && (
                                                        <div style={{ 
                                                            marginTop: '10px',
                                                            padding: '10px',
                                                            background: request.isApproved ? '#f0fdf4' : '#fef2f2',
                                                            borderRadius: '6px',
                                                            borderLeft: `3px solid ${request.statusColor}`
                                                        }}>
                                                            <strong style={{ fontSize: '12px', color: '#333' }}>Hospital Response:</strong>
                                                            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#111' }}>
                                                                {request.hospitalResponse}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                        {/* Ward Requests Section */}
                        <div>
                            <h3 style={{ 
                                fontSize: '18px', 
                                color: '#333', 
                                marginBottom: '15px',
                                paddingBottom: '10px',
                                borderBottom: '2px solid #e5e7eb'
                            }}>
                                🏥 Ward Requests to Process
                            </h3>

                            {wardRequests.length === 0 ? (
                                <div style={{ 
                                    padding: '40px', 
                                    textAlign: 'center', 
                                    background: '#f9fafb', 
                                    borderRadius: '8px',
                                    color: '#6b7280'
                                }}>
                                    <p style={{ fontSize: '18px', marginBottom: '10px' }}>✓ No pending requests</p>
                                    <p style={{ fontSize: '14px' }}>All ward requests have been processed</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '15px' }}>
                                    {wardRequests.map((request, index) => (
                                        <div key={index} style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '20px',
                                            background: request.storeApproved ? '#f0fdf4' : '#fffbeb'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                                <div>
                                                    <h3 style={{ margin: '0 0 10px 0', color: '#111827' }}>{request.assetName}</h3>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px' }}>
                                                        <p><strong>Type:</strong> {request.itemType}</p>
                                                        <p><strong>Requested By:</strong> {request.wardName}</p>
                                                        <p><strong>Patient ID:</strong> {request.patientId || 'N/A'}</p>
                                                        <p><strong>Quantity:</strong> {request.quantity} units</p>
                                                        <p><strong>Available:</strong> {request.availableQuantity} units</p>
                                                        <p><strong>Requested:</strong> {request.timestamp}</p>
                                                    </div>
                                                    {request.remarks && (
                                                        <p style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>
                                                            <strong>Remarks:</strong> {request.remarks}
                                                        </p>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                                                    {request.storeApproved ? (
                                                        <span style={{ 
                                                            padding: '5px 12px', 
                                                            background: '#10b981', 
                                                            color: 'white', 
                                                            borderRadius: '5px',
                                                            fontSize: '12px',
                                                            fontWeight: '600'
                                                        }}>
                                                            ✓ You Approved
                                                        </span>
                                                    ) : (
                                                        <span style={{ 
                                                            padding: '5px 12px', 
                                                            background: '#f59e0b', 
                                                            color: 'white', 
                                                            borderRadius: '5px',
                                                            fontSize: '12px',
                                                            fontWeight: '600'
                                                        }}>
                                                            Pending Your Approval
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                                {!request.issued && (
                                                    <button
                                                        onClick={() => handleIssueClick(request)}
                                                        disabled={request.availableQuantity < request.quantity}
                                                        style={{
                                                            padding: '10px 20px',
                                                            background: request.availableQuantity >= request.quantity ? '#3b82f6' : '#9ca3af',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '5px',
                                                            cursor: request.availableQuantity >= request.quantity ? 'pointer' : 'not-allowed',
                                                            fontWeight: '600',
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        📦 Issue to Ward
                                                    </button>
                                                )}
                                                {request.availableQuantity < request.quantity && (
                                                    <span style={{ 
                                                        fontSize: '13px', 
                                                        color: '#dc2626',
                                                        alignSelf: 'center'
                                                    }}>
                                                        ⚠️ Insufficient stock - Request from Hospital Authority
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Issue Form */
                    <form onSubmit={handleIssueSubmit}>
                        <h3 style={{ marginBottom: '20px' }}>Issue Item to Ward</h3>
                        
                        <div style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px' }}>
                                    Item
                                </label>
                                <input
                                    type="text"
                                    value={issueFormData.assetName}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ddd',
                                        borderRadius: '5px',
                                        background: '#f9fafb'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px' }}>
                                    Ward Name
                                </label>
                                <input
                                    type="text"
                                    value={issueFormData.wardName}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ddd',
                                        borderRadius: '5px',
                                        background: '#f9fafb'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px' }}>
                                    Patient ID
                                </label>
                                <input
                                    type="text"
                                    value={issueFormData.patientId}
                                    onChange={(e) => setIssueFormData({...issueFormData, patientId: e.target.value})}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ddd',
                                        borderRadius: '5px'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px' }}>
                                    Quantity to Issue
                                </label>
                                <input
                                    type="number"
                                    value={issueFormData.quantity}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #ddd',
                                        borderRadius: '5px',
                                        background: '#f9fafb'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    padding: '12px 30px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    fontSize: '16px'
                                }}
                            >
                                {loading ? 'Issuing...' : 'Confirm Issue'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowIssueForm(false)}
                                style={{
                                    padding: '12px 30px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '16px'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StoreManagerDashboard;
