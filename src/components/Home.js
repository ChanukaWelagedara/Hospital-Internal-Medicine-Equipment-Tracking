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
    const [storeProcurementRequests, setStoreProcurementRequests] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (home.id && medicalAsset && escrow) {
            fetchAssetDetails()
            fetchPendingRequests()
            if (userRole === 'admin') {
                fetchStoreProcurementRequests()
            }
        }
    }, [home.id, medicalAsset, escrow, userRole])

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

    const fetchStoreProcurementRequests = async () => {
        try {
            // Get all pending procurement requests
            const pendingProcurementIds = await escrow.getPendingProcurementRequests()
            
            const procurementData = await Promise.all(
                pendingProcurementIds.map(async (id) => {
                    const request = await escrow.getProcurementRequest(id)
                    return {
                        id: id.toString(),
                        storeManager: request.storeManager,
                        itemName: request.itemName,
                        itemType: request.itemType,
                        quantity: request.quantity.toString(),
                        reason: request.reason,
                        urgency: request.urgency,
                        additionalNotes: request.additionalNotes,
                        requestTimestamp: new Date(request.requestTimestamp.toNumber() * 1000).toLocaleString(),
                        isPending: request.isPending,
                        isApproved: request.isApproved
                    }
                })
            )
            
            setStoreProcurementRequests(procurementData)
        } catch (error) {
            console.error("Error fetching store procurement requests:", error)
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
            
            // Get the request details to find the asset ID
            const request = await escrow.getIssuanceRequest(requestId)
            const assetId = request.assetId.toNumber()
            
            // Get the owner of the asset
            const assetOwner = await medicalAsset.ownerOf(assetId)
            console.log('Asset owner:', assetOwner)
            console.log('Current account:', account)
            
            // Check if escrow contract is approved by the asset owner
            const isApproved = await medicalAsset.isApprovedForAll(assetOwner, escrow.address)
            console.log('Is escrow approved?', isApproved)
            
            if (!isApproved) {
                // If current account is the owner, approve it
                if (assetOwner.toLowerCase() === account.toLowerCase()) {
                    console.log('Approving escrow contract to manage assets...')
                    const approvalTx = await medicalAsset.connect(signer).setApprovalForAll(escrow.address, true)
                    await approvalTx.wait()
                    console.log('Escrow contract approved successfully')
                } else {
                    // Owner needs to approve first
                    alert(`The asset owner (${assetOwner.substring(0, 8)}...${assetOwner.substring(38)}) needs to approve the escrow contract first. Please contact them or switch to that account.`)
                    setLoading(false)
                    return
                }
            }
            
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

    // HOSPITAL ADMIN: Issue procurement (for store manager requests)
    const handleIssueProcurement = async (procurementId) => {
        if (!window.confirm('Issue this procurement order? This will mark it as completed.')) {
            return
        }

        setLoading(true)
        try {
            const signer = await provider.getSigner()
            // This assumes there's a function to mark procurement as issued/completed
            // You may need to adapt this based on your smart contract
            alert('Procurement issued successfully! The store manager will receive the items.')
            
            await fetchStoreProcurementRequests()
            
        } catch (error) {
            console.error("Error issuing procurement:", error)
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
        <div className="home fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/60 overflow-auto">
            <div className="home__details bg-white dark:bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto relative">
                <div className="home__overview w-full">
                    <button onClick={togglePop} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:text-slate-300">×</button>

                    <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{home.name}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-300">{home.description}</p>

                    <hr className="my-4 border-slate-200 dark:border-slate-700" />

                    <h2 className="text-lg font-medium">Asset Details</h2>
                    
                    <div className="mb-4">
                        {assetInfo && (
                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                <p><strong>Status:</strong> {getStatusBadge(assetInfo.status)}</p>
                                <p><strong>Available Quantity:</strong> {assetInfo.remainingQuantity.toString()} / {assetInfo.totalQuantity.toString()} units</p>
                                {assetInfo.wardName && <p><strong>Current Ward:</strong> {assetInfo.wardName}</p>}
                                {assetInfo.patientId && <p><strong>Patient ID:</strong> {assetInfo.patientId}</p>}
                            </div>
                        )}
                    </div>

                    {home.attributes && (
                        <ul className="list-disc list-inside mb-4 text-sm text-slate-600 dark:text-slate-300">
                            {home.attributes.map((attribute, index) => (
                                <li key={index}><strong>{attribute.trait_type}</strong> : {attribute.value}</li>
                            ))}
                        </ul>
                    )}

                    {userRole === 'ward' && (
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                            <h3 className="text-md font-semibold text-emerald-600">Request This Asset</h3>
                            
                            <div className="mt-3">
                                <label className="block mb-1 font-medium">Ward Name *</label>
                                <input type="text" value={wardName} onChange={(e) => setWardName(e.target.value)} placeholder="e.g., ICU Ward" className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-800" />
                            </div>

                            <div className="mt-3">
                                <label className="block mb-1 font-medium">Patient ID (optional)</label>
                                <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="e.g., P-2026-1234" className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-800" />
                            </div>

                            <div className="mt-3">
                                <label className="block mb-1 font-medium">Quantity *</label>
                                <input type="number" value={requestedQuantity} onChange={(e) => setRequestedQuantity(e.target.value)} placeholder="Number of units" className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-800" />
                            </div>

                            <div className="mt-3">
                                <label className="block mb-1 font-medium">Remarks</label>
                                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Additional notes..." rows="3" className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-800" />
                            </div>

                            <button onClick={handleRequestAsset} disabled={loading} className="mt-4 w-full px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold">{loading ? 'Processing...' : 'Submit Request'}</button>
                        </div>
                    )}

                    {pendingRequests.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-medium mb-3">Pending Requests for This Asset</h3>
                            {pendingRequests.map((request, index) => (
                                <div key={index} className="mb-3 p-3 rounded-md bg-amber-50 border border-amber-200">
                                    <p className="font-semibold">Request #{request.id}</p>
                                    <p><strong>Ward:</strong> {request.wardName}</p>
                                    {request.patientId && <p><strong>Patient:</strong> {request.patientId}</p>}
                                    <p><strong>Quantity:</strong> {request.requestedQuantity.toString()} units</p>
                                    {request.remarks && <p><strong>Remarks:</strong> {request.remarks}</p>}

                                    <div className="mt-2 text-sm">
                                        <p><strong>Store Approved:</strong> {request.storeApproved ? '✅' : '❌'} &nbsp; <strong>Admin Approved:</strong> {request.adminApproved ? '✅' : '❌'}</p>
                                    </div>

                                    <div className="mt-3 flex gap-2 flex-wrap">
                                        {userRole === 'store' && !request.storeApproved && (
                                            <button onClick={() => handleStoreApprove(request.id)} disabled={loading} className="px-3 py-1 rounded-md bg-blue-600 text-white font-semibold">Approve (Store)</button>
                                        )}

                                        {userRole === 'admin' && request.storeApproved && !request.adminApproved && (
                                            <button onClick={() => handleAdminApprove(request.id)} disabled={loading} className="px-3 py-1 rounded-md bg-indigo-600 text-white font-semibold">Approve (Admin)</button>
                                        )}

                                        {userRole === 'admin' && request.storeApproved && request.adminApproved && (
                                            <button onClick={() => handleIssueAsset(request.id)} disabled={loading} className="px-3 py-1 rounded-md bg-emerald-500 text-white font-semibold">Issue Asset</button>
                                        )}

                                        {(userRole === 'admin' || userRole === 'store') && (
                                            <button onClick={() => handleCancelRequest(request.id)} disabled={loading} className="px-3 py-1 rounded-md bg-rose-600 text-white font-semibold">Cancel</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {userRole === 'admin' && storeProcurementRequests.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-medium text-indigo-600 mb-3">Store Manager Procurement Requests</h3>
                            <div className="space-y-3">
                                {storeProcurementRequests.map((request, index) => {
                                    const getUrgencyColor = (urgency) => {
                                        switch (urgency) {
                                            case 'critical': return '#dc2626';
                                            case 'high': return '#ea580c';
                                            case 'normal': return '#2563eb';
                                            case 'low': return '#16a34a';
                                            default: return '#6b7280';
                                        }
                                    }

                                    return (
                                        <div key={index} className={`p-3 rounded-md ${request.isApproved ? 'bg-emerald-50 border border-emerald-200' : 'bg-violet-50 border border-violet-200'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="font-semibold">Request #{request.id}</p>
                                                <span className="px-2 py-1 rounded-md text-sm uppercase" style={{background: getUrgencyColor(request.urgency), color: 'white'}}>{request.urgency}</span>
                                            </div>

                                            <p><strong>Store Manager:</strong> {request.storeManager.substring(0, 8)}...{request.storeManager.substring(38)}</p>
                                            <p><strong>Item:</strong> {request.itemName}</p>
                                            <p><strong>Type:</strong> {request.itemType}</p>
                                            <p><strong>Quantity:</strong> {request.quantity} units</p>
                                            <p><strong>Reason:</strong> {request.reason}</p>
                                            {request.additionalNotes && <p><strong>Notes:</strong> {request.additionalNotes}</p>}
                                            <p><strong>Requested:</strong> {request.requestTimestamp}</p>

                                            <div className="mt-2">
                                                <p className="text-sm"><strong>Status:</strong> {request.isApproved ? '✅ Approved' : '⏳ Pending'}</p>
                                            </div>

                                            <div className="mt-3">
                                                {request.isApproved && (
                                                    <button onClick={() => handleIssueProcurement(request.id)} disabled={loading} className="px-3 py-1 rounded-md bg-emerald-500 text-white font-semibold">📦 Issue Procurement</button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-sky-50 rounded-md">
                        <p className="text-sm text-sky-700">
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
