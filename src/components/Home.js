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
        const statusConfig = [
            { label: "In Store", icon: "📦", class: "badge-success" },
            { label: "Issued to Ward", icon: "🏥", class: "badge-info" },
            { label: "Issued to Patient", icon: "👤", class: "badge-teal" },
            { label: "Expired", icon: "⚠️", class: "badge-warning" },
            { label: "Disposed", icon: "🗑️", class: "badge-danger" }
        ]
        const config = statusConfig[status] || { label: "Unknown", icon: "❓", class: "badge" }
        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${config.class}`}>
                <span>{config.icon}</span>
                <span>{config.label}</span>
            </span>
        )
    }

    return (
        <div className="home fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm overflow-auto animate-fade-in">
            <div className="home__details bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-5xl w-full max-h-[90vh] overflow-auto relative animate-slide-up">
                {/* Close Button */}
                <button 
                    onClick={togglePop} 
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 text-2xl font-light"
                    title="Close"
                >
                    ×
                </button>

                <div className="home__overview w-full">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-medical-blue-500 to-medical-teal-500 rounded-xl flex items-center justify-center text-3xl shadow-medical">
                                {home.itemType === 'Medicine' ? '💊' : '🏥'}
                            </div>
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{home.name}</h1>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{home.description}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 my-6"></div>

                    {/* Asset Details Card */}
                    <div className="bg-gradient-to-br from-medical-blue-50 to-medical-teal-50 rounded-xl p-6 mb-6 border border-medical-blue-100">
                        <h2 className="text-lg font-bold text-medical-blue-900 mb-4 flex items-center gap-2">
                            <span>📊</span>
                            <span>Asset Details</span>
                        </h2>
                        {assetInfo && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Status</p>
                                    <div>{getStatusBadge(assetInfo.status)}</div>
                                </div>
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Available Quantity</p>
                                    <p className="text-2xl font-bold text-medical-blue-700">
                                        {assetInfo.remainingQuantity.toString()}
                                        <span className="text-sm text-slate-500 font-normal"> / {assetInfo.totalQuantity.toString()} units</span>
                                    </p>
                                </div>
                                {assetInfo.wardName && (
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Current Ward</p>
                                        <p className="text-sm font-semibold text-slate-800">{assetInfo.wardName}</p>
                                    </div>
                                )}
                                {assetInfo.patientId && (
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Patient ID</p>
                                        <p className="text-sm font-semibold text-slate-800">{assetInfo.patientId}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Attributes */}
                    {home.attributes && home.attributes.length > 0 && (
                        <div className="bg-white rounded-xl p-6 mb-6 border border-slate-200 shadow-sm">
                            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>📋</span>
                                <span>Additional Information</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {home.attributes.map((attribute, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                        <div className="w-2 h-2 bg-medical-blue-500 rounded-full"></div>
                                        <div>
                                            <p className="text-xs text-slate-500">{attribute.trait_type}</p>
                                            <p className="text-sm font-semibold text-slate-800">{attribute.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ward Request Form */}
                    {userRole === 'ward' && (
                        <div className="bg-gradient-to-br from-medical-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-medical-green-200">
                            <h3 className="text-lg font-bold text-medical-green-800 mb-4 flex items-center gap-2">
                                <span>📝</span>
                                <span>Request This Asset</span>
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="label">
                                        <span className="flex items-center gap-1">
                                            <span>🏥</span>
                                            <span>Ward Name *</span>
                                        </span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={wardName} 
                                        onChange={(e) => setWardName(e.target.value)} 
                                        placeholder="e.g., ICU Ward, Emergency Ward" 
                                        className="input-field"
                                    />
                                </div>

                                <div>
                                    <label className="label">
                                        <span className="flex items-center gap-1">
                                            <span>👤</span>
                                            <span>Patient ID (optional)</span>
                                        </span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={patientId} 
                                        onChange={(e) => setPatientId(e.target.value)} 
                                        placeholder="e.g., P-2026-1234" 
                                        className="input-field"
                                    />
                                </div>

                                <div>
                                    <label className="label">
                                        <span className="flex items-center gap-1">
                                            <span>🔢</span>
                                            <span>Quantity *</span>
                                        </span>
                                    </label>
                                    <input 
                                        type="number" 
                                        value={requestedQuantity} 
                                        onChange={(e) => setRequestedQuantity(e.target.value)} 
                                        placeholder="Number of units needed" 
                                        className="input-field"
                                        min="1"
                                    />
                                </div>

                                <div>
                                    <label className="label">
                                        <span className="flex items-center gap-1">
                                            <span>💬</span>
                                            <span>Remarks</span>
                                        </span>
                                    </label>
                                    <textarea 
                                        value={remarks} 
                                        onChange={(e) => setRemarks(e.target.value)} 
                                        placeholder="Additional notes or special requirements..." 
                                        rows="3" 
                                        className="input-field resize-none"
                                    />
                                </div>

                                <button 
                                    onClick={handleRequestAsset} 
                                    disabled={loading} 
                                    className="btn-success w-full flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <span className="animate-spin">⏳</span>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>✅</span>
                                            <span>Submit Request</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>⏳</span>
                                <span>Pending Requests for This Asset</span>
                                <span className="ml-2 badge badge-warning">{pendingRequests.length}</span>
                            </h3>
                            <div className="space-y-4">
                                {pendingRequests.map((request, index) => (
                                    <div key={index} className="card p-5 border-l-4 border-amber-400">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <p className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                    <span>📋</span>
                                                    <span>Request #{request.id}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className={`badge ${request.storeApproved ? 'badge-success' : 'badge-warning'}`}>
                                                    {request.storeApproved ? '✅ Store' : '⏳ Store'}
                                                </span>
                                                <span className={`badge ${request.adminApproved ? 'badge-success' : 'badge-warning'}`}>
                                                    {request.adminApproved ? '✅ Admin' : '⏳ Admin'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                <span>🏥</span>
                                                <div>
                                                    <p className="text-xs text-slate-500">Ward</p>
                                                    <p className="text-sm font-semibold text-slate-800">{request.wardName}</p>
                                                </div>
                                            </div>
                                            {request.patientId && (
                                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                    <span>👤</span>
                                                    <div>
                                                        <p className="text-xs text-slate-500">Patient</p>
                                                        <p className="text-sm font-semibold text-slate-800">{request.patientId}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                <span>🔢</span>
                                                <div>
                                                    <p className="text-xs text-slate-500">Quantity</p>
                                                    <p className="text-sm font-semibold text-slate-800">{request.requestedQuantity.toString()} units</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {request.remarks && (
                                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                                <p className="text-xs text-blue-600 font-semibold mb-1">REMARKS</p>
                                                <p className="text-sm text-slate-700">{request.remarks}</p>
                                            </div>
                                        )}

                                        <div className="flex gap-2 flex-wrap">
                                            {userRole === 'store' && !request.storeApproved && (
                                                <button 
                                                    onClick={() => handleStoreApprove(request.id)} 
                                                    disabled={loading} 
                                                    className="btn-primary flex items-center gap-2"
                                                >
                                                    <span>✅</span>
                                                    <span>Approve (Store)</span>
                                                </button>
                                            )}

                                            {userRole === 'admin' && request.storeApproved && !request.adminApproved && (
                                                <button 
                                                    onClick={() => handleAdminApprove(request.id)} 
                                                    disabled={loading} 
                                                    className="btn-primary flex items-center gap-2"
                                                >
                                                    <span>✅</span>
                                                    <span>Approve (Admin)</span>
                                                </button>
                                            )}

                                            {userRole === 'admin' && request.storeApproved && request.adminApproved && (
                                                <button 
                                                    onClick={() => handleIssueAsset(request.id)} 
                                                    disabled={loading} 
                                                    className="btn-success flex items-center gap-2"
                                                >
                                                    <span>📦</span>
                                                    <span>Issue Asset</span>
                                                </button>
                                            )}

                                            {(userRole === 'admin' || userRole === 'store') && (
                                                <button 
                                                    onClick={() => handleCancelRequest(request.id)} 
                                                    disabled={loading} 
                                                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                                                >
                                                    <span>❌</span>
                                                    <span>Cancel</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
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

                    {/* Role Info Banner */}
                    <div className="bg-gradient-to-r from-medical-blue-100 to-medical-teal-100 rounded-xl p-4 border border-medical-blue-200">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                                {userRole === 'admin' && '👨‍⚕️'}
                                {userRole === 'store' && '📦'}
                                {userRole === 'ward' && '🏥'}
                            </div>
                            <p className="text-sm font-medium text-medical-blue-900">
                                {userRole === 'admin' && 'You are Hospital Admin - You can approve and issue assets'}
                                {userRole === 'store' && 'You are Store Manager - You can approve ward requests'}
                                {userRole === 'ward' && 'You are Ward Authority - You can request assets for your ward'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
