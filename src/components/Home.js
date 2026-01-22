import { useEffect, useState } from 'react';

const Home = ({ home, provider, account, escrow, medicalAsset, togglePop, userRole, hospitalAdmin, storeManager, onRequestComplete }) => {
    // Request form states (for Ward Authority)
    const [wardName, setWardName] = useState('')
    const [patientId, setPatientId] = useState('')
    const [requestedQuantity, setRequestedQuantity] = useState('')
    const [remarks, setRemarks] = useState('')
    
    // Asset details
    const [assetInfo, setAssetInfo] = useState(null)
    const [pendingRequests, setPendingRequests] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (home.id && medicalAsset && escrow) {
            fetchAssetDetails()
            fetchPendingRequests()
        }
    }, [home.id, medicalAsset, escrow])

    const fetchAssetDetails = async () => {
        try {
            const info = await medicalAsset.getAssetInfo(home.id)
            setAssetInfo(info)
        } catch (error) {
            console.error("Error fetching asset info:", error)
        }
    }

    const fetchPendingRequests = async () => {
        try {
            // Get all pending requests
            const allPending = await escrow.getPendingRequests()
            
            // Filter requests for this asset
            const assetRequests = []
            for (let i = 0; i < allPending.length; i++) {
                const reqId = allPending[i].toNumber()
                const request = await escrow.getIssuanceRequest(reqId)
                if (request.assetId.toNumber() === home.id) {
                    assetRequests.push({
                        id: reqId,
                        ...request
                    })
                }
            }
            
            setPendingRequests(assetRequests)
        } catch (error) {
            console.error("Error fetching requests:", error)
        }
    }

    // WARD AUTHORITY: Request asset
    const handleRequestAsset = async () => {
        if (!wardName || !requestedQuantity) {
            alert('Please fill ward name and quantity')
            return
        }

        if (parseInt(requestedQuantity) <= 0) {
            alert('Quantity must be greater than 0')
            return
        }

        if (assetInfo && parseInt(requestedQuantity) > assetInfo.remainingQuantity) {
            alert(`Only ${assetInfo.remainingQuantity} units available`)
            return
        }

        setLoading(true)
        try {
            const signer = await provider.getSigner()
            
            const transaction = await escrow.connect(signer).requestAsset(
                home.id,
                wardName,
                patientId || "",
                requestedQuantity,
                remarks || ""
            )
            
            await transaction.wait()
            
            alert('Request submitted successfully!')
            
            // Reset form
            setWardName('')
            setPatientId('')
            setRequestedQuantity('')
            setRemarks('')
            
            // Refresh data
            await fetchAssetDetails()
            await fetchPendingRequests()
            if (onRequestComplete) onRequestComplete()
            
        } catch (error) {
            console.error("Error requesting asset:", error)
            alert('Error submitting request: ' + (error.reason || error.message))
        }
        setLoading(false)
    }

    // STORE MANAGER: Approve request
    const handleStoreApprove = async (requestId) => {
        setLoading(true)
        try {
            const signer = await provider.getSigner()
            const transaction = await escrow.connect(signer).approveByStore(requestId)
            await transaction.wait()
            
            alert('Request approved by Store Manager!')
            await fetchPendingRequests()
            
        } catch (error) {
            console.error("Error approving request:", error)
            alert('Error: ' + (error.reason || error.message))
        }
        setLoading(false)
    }

    // HOSPITAL ADMIN: Approve request
    const handleAdminApprove = async (requestId) => {
        setLoading(true)
        try {
            const signer = await provider.getSigner()
            const transaction = await escrow.connect(signer).approveByAdmin(requestId)
            await transaction.wait()
            
            alert('Request approved by Hospital Admin!')
            await fetchPendingRequests()
            
        } catch (error) {
            console.error("Error approving request:", error)
            alert('Error: ' + (error.reason || error.message))
        }
        setLoading(false)
    }

    // HOSPITAL ADMIN: Issue asset
    const handleIssueAsset = async (requestId) => {
        if (!window.confirm('Issue this asset? This action cannot be undone.')) {
            return
        }

        setLoading(true)
        try {
            const signer = await provider.getSigner()
            const transaction = await escrow.connect(signer).issueAsset(requestId)
            await transaction.wait()
            
            alert('Asset issued successfully! 🎉')
            
            await fetchAssetDetails()
            await fetchPendingRequests()
            if (onRequestComplete) onRequestComplete()
            
        } catch (error) {
            console.error("Error issuing asset:", error)
            alert('Error: ' + (error.reason || error.message))
        }
        setLoading(false)
    }

    // Cancel request (any authorized role)
    const handleCancelRequest = async (requestId) => {
        if (!window.confirm('Cancel this request?')) {
            return
        }

        setLoading(true)
        try {
            const signer = await provider.getSigner()
            const transaction = await escrow.connect(signer).cancelRequest(requestId, "User cancelled")
            await transaction.wait()
            
            alert('Request cancelled')
            await fetchPendingRequests()
            
        } catch (error) {
            console.error("Error cancelling request:", error)
            alert('Error: ' + (error.reason || error.message))
        }
        setLoading(false)
    }

    const getStatusBadge = (status) => {
        const statuses = ["In Store", "Issued to Ward", "Issued to Patient", "Expired", "Disposed"]
        const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
        return (
            <span style={{
                background: colors[status] || "#6b7280",
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
            }}>
                {statuses[status] || "Unknown"}
            </span>
        )
    }

    return (
        <div className="home">
            <div className='home__details'>
                <div className="home__overview" style={{ width: '100%' }}>
                    <button onClick={togglePop} className="home__close">
                        ×
                    </button>

                    <h1>{home.name}</h1>
                    <p>{home.description}</p>

                    <hr />

                    <h2>Asset Details</h2>
                    
                    <div style={{ marginBottom: '20px' }}>
                        {assetInfo && (
                            <>
                                <p><strong>Status:</strong> {getStatusBadge(assetInfo.status)}</p>
                                <p><strong>Available Quantity:</strong> {assetInfo.remainingQuantity.toString()} / {assetInfo.totalQuantity.toString()} units</p>
                                {assetInfo.wardName && <p><strong>Current Ward:</strong> {assetInfo.wardName}</p>}
                                {assetInfo.patientId && <p><strong>Patient ID:</strong> {assetInfo.patientId}</p>}
                            </>
                        )}
                    </div>

                    {home.attributes && (
                        <ul>
                            {home.attributes.map((attribute, index) => (
                                <li key={index}>
                                    <strong>{attribute.trait_type}</strong> : {attribute.value}
                                </li>
                            ))}
                        </ul>
                    )}

                    <hr />

                    {/* WARD AUTHORITY VIEW: Request Form */}
                    {userRole === 'ward' && (
                        <div style={{ marginTop: '20px', padding: '15px', background: '#f3f4f6', borderRadius: '8px' }}>
                            <h3 style={{ color: '#10b981' }}>Request This Asset</h3>
                            
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Ward Name *</label>
                                <input 
                                    type="text" 
                                    value={wardName}
                                    onChange={(e) => setWardName(e.target.value)}
                                    placeholder="e.g., ICU Ward"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Patient ID (optional)</label>
                                <input 
                                    type="text" 
                                    value={patientId}
                                    onChange={(e) => setPatientId(e.target.value)}
                                    placeholder="e.g., P-2026-1234"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Quantity *</label>
                                <input 
                                    type="number" 
                                    value={requestedQuantity}
                                    onChange={(e) => setRequestedQuantity(e.target.value)}
                                    placeholder="Number of units"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Remarks</label>
                                <textarea 
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Additional notes..."
                                    rows="3"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <button 
                                onClick={handleRequestAsset}
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                {loading ? 'Processing...' : 'Submit Request'}
                            </button>
                        </div>
                    )}

                    {/* PENDING REQUESTS VIEW (All Roles) */}
                    {pendingRequests.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <h3>Pending Requests for This Asset</h3>
                            
                            {pendingRequests.map((request, index) => (
                                <div key={index} style={{ 
                                    padding: '15px', 
                                    background: '#fef3c7', 
                                    borderRadius: '8px', 
                                    marginBottom: '10px',
                                    border: '1px solid #fbbf24'
                                }}>
                                    <p><strong>Request #{request.id}</strong></p>
                                    <p><strong>Ward:</strong> {request.wardName}</p>
                                    {request.patientId && <p><strong>Patient:</strong> {request.patientId}</p>}
                                    <p><strong>Quantity:</strong> {request.requestedQuantity.toString()} units</p>
                                    {request.remarks && <p><strong>Remarks:</strong> {request.remarks}</p>}
                                    
                                    <div style={{ marginTop: '10px' }}>
                                        <p style={{ fontSize: '14px' }}>
                                            <strong>Store Approved:</strong> {request.storeApproved ? '✅' : '❌'} &nbsp;
                                            <strong>Admin Approved:</strong> {request.adminApproved ? '✅' : '❌'}
                                        </p>
                                    </div>

                                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {/* Store Manager Actions */}
                                        {userRole === 'store' && !request.storeApproved && (
                                            <button 
                                                onClick={() => handleStoreApprove(request.id)}
                                                disabled={loading}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Approve (Store)
                                            </button>
                                        )}

                                        {/* Hospital Admin Actions */}
                                        {userRole === 'admin' && request.storeApproved && !request.adminApproved && (
                                            <button 
                                                onClick={() => handleAdminApprove(request.id)}
                                                disabled={loading}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: '#8b5cf6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Approve (Admin)
                                            </button>
                                        )}

                                        {userRole === 'admin' && request.storeApproved && request.adminApproved && (
                                            <button 
                                                onClick={() => handleIssueAsset(request.id)}
                                                disabled={loading}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Issue Asset
                                            </button>
                                        )}

                                        {/* Cancel button (available to authorized users) */}
                                        {(userRole === 'admin' || userRole === 'store') && (
                                            <button 
                                                onClick={() => handleCancelRequest(request.id)}
                                                disabled={loading}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Info message for different roles */}
                    <div style={{ marginTop: '20px', padding: '10px', background: '#e0f2fe', borderRadius: '5px' }}>
                        <p style={{ fontSize: '14px', color: '#0369a1' }}>
                            {userRole === 'admin' && '👨‍⚕️ You are Hospital Admin - You can approve and issue assets'}
                            {userRole === 'store' && '📦 You are Store Manager - You can approve ward requests'}
                            {userRole === 'ward' && '🏥 You are Ward Authority - You can request assets for your ward'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
