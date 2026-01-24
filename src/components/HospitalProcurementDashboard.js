import { useEffect, useState } from 'react';

const HospitalProcurementDashboard = ({ provider, account, escrow, onClose }) => {
    const [procurementRequests, setProcurementRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [responseData, setResponseData] = useState({});
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState(null);

    useEffect(() => {
        loadProcurementRequests();
    }, []);

    const loadProcurementRequests = async () => {
        try {
            // Get total procurement counter
            const procurementCounter = await escrow.procurementCounter();
            const totalRequests = procurementCounter.toNumber();
            
            console.log('Total procurement requests:', totalRequests);
            
            const requestsData = [];
            
            // Load all procurement requests (from 1 to procurementCounter)
            for (let i = 1; i <= totalRequests; i++) {
                const request = await escrow.getProcurementRequest(i);
                
                // Determine status
                let status = 'Pending';
                let statusColor = '#f59e0b';
                let statusIcon = '⏳';
                
                if (request.isApproved) {
                    status = 'Approved';
                    statusColor = '#16a34a';
                    statusIcon = '✅';
                } else if (request.isRejected) {
                    status = 'Rejected';
                    statusColor = '#dc2626';
                    statusIcon = '❌';
                }
                
                requestsData.push({
                    id: i.toString(),
                    storeManager: request.storeManager,
                    itemName: request.itemName,
                    itemType: request.itemType,
                    quantity: request.quantity.toString(),
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
                    statusColor,
                    statusIcon
                });
            }
            
            // Sort by most recent first
            requestsData.sort((a, b) => parseInt(b.id) - parseInt(a.id));
            
            setProcurementRequests(requestsData);
            console.log('Loaded all procurement requests:', requestsData.length);
        } catch (error) {
            console.error('Error loading procurement requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApproveClick = (requestId) => {
        setActiveRequestId(requestId);
        setShowResponseModal(true);
        setResponseData({ action: 'approve', response: '' });
    };

    const handleRejectClick = (requestId) => {
        setActiveRequestId(requestId);
        setShowResponseModal(true);
        setResponseData({ action: 'reject', response: '' });
    };

    const handleSubmitResponse = async () => {
        if (!responseData.response.trim()) {
            alert('Please provide a response message');
            return;
        }

        try {
            setLoading(true);
            const signer = await provider.getSigner();

            if (responseData.action === 'approve') {
                const tx = await escrow.connect(signer).approveProcurementRequest(
                    activeRequestId,
                    responseData.response
                );
                await tx.wait();
                alert('Procurement request approved successfully!');
            } else {
                const tx = await escrow.connect(signer).rejectProcurementRequest(
                    activeRequestId,
                    responseData.response
                );
                await tx.wait();
                alert('Procurement request rejected.');
            }

            setShowResponseModal(false);
            setActiveRequestId(null);
            setResponseData({});
            loadProcurementRequests();
        } catch (error) {
            console.error('Error processing request:', error);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getUrgencyColor = (urgency) => {
        switch (urgency) {
            case 'critical': return '#dc2626';
            case 'high': return '#ea580c';
            case 'normal': return '#2563eb';
            case 'low': return '#16a34a';
            default: return '#6b7280';
        }
    };

    const getReasonLabel = (reason) => {
        const labels = {
            'out_of_stock': 'Out of Stock',
            'low_stock': 'Low Stock',
            'high_demand': 'High Demand',
            'expiring': 'Items Expiring',
            'seasonal': 'Seasonal Demand',
            'emergency': 'Emergency Need'
        };
        return labels[reason] || reason;
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
                        <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-medical-blue-500 to-indigo-600 rounded-xl shadow-medical">
                            <span className="text-3xl">👨‍⚕️</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Procurement Requests</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Review and approve stock requests from the Store Manager</p>
                        </div>
                    </div>
                </div>

                {loading && procurementRequests.length === 0 ? (
                    <div className="flex items-center justify-center gap-3 p-12 bg-blue-50 rounded-xl border border-blue-200">
                        <span className="animate-spin text-2xl">⏳</span>
                        <span className="text-blue-700 font-medium">Loading procurement requests...</span>
                    </div>
                ) : procurementRequests.length === 0 ? (
                    <div className="card p-16 text-center">
                        <div className="text-7xl mb-4">📊</div>
                        <p className="text-xl font-semibold text-slate-700 mb-2">No Procurement Requests</p>
                        <p className="text-sm text-slate-500">Store Manager hasn't submitted any stock requests yet</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {procurementRequests.map((request) => (
                            <div key={request.id} className={`card-medical p-6 border-l-4 ${
                                request.isApproved ? 'border-emerald-500 bg-emerald-50/30' :
                                request.isRejected ? 'border-red-500 bg-red-50/30' :
                                'border-amber-500 bg-amber-50/30'
                            } hover:scale-[1.01] transition-transform duration-200`}>
                                {/* Header */}
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-2xl">{request.itemType === 'medicine' ? '💊' : '🏥'}</span>
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{request.itemName}</h3>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <span className="badge badge-info">{request.itemType.toUpperCase()}</span>
                                            <span 
                                                className="badge" 
                                                style={{
                                                    background: getUrgencyColor(request.urgency), 
                                                    color: 'white'
                                                }}
                                            >
                                                {request.urgency === 'critical' ? '🔴' : request.urgency === 'high' ? '🟠' : request.urgency === 'low' ? '🟢' : '🔵'} {request.urgency.toUpperCase()}
                                            </span>
                                            <span className="badge badge-warning">{getReasonLabel(request.reason)}</span>
                                            <span className={`badge flex items-center gap-1 ${
                                                request.isApproved ? 'badge-success' :
                                                request.isRejected ? 'badge-danger' :
                                                'badge-warning'
                                            }`}>
                                                {request.statusIcon} {request.status}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="badge badge-info text-sm">Request #{request.id}</span>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                                        <span className="text-2xl">🔢</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">Requested Quantity</p>
                                            <p className="text-xl font-bold text-medical-blue-700">{request.quantity} units</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                                        <span className="text-2xl">👤</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">Requested By</p>
                                            <p className="text-sm font-mono font-semibold text-slate-800">{request.storeManager.slice(0, 6)}...{request.storeManager.slice(-4)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                                        <span className="text-2xl">📅</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">Request Date</p>
                                            <p className="text-sm font-semibold text-slate-800">{request.requestTimestamp}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Approval Timestamp */}
                                {request.approvedTimestamp && (
                                    <div className="bg-gradient-to-r from-emerald-100 to-emerald-50 p-4 rounded-lg mb-4 border border-emerald-300">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">✅</span>
                                            <div>
                                                <p className="text-sm font-bold text-emerald-800">Approved</p>
                                                <p className="text-xs text-emerald-700">{request.approvedTimestamp}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hospital Response */}
                                {request.hospitalResponse && (
                                    <div className="bg-slate-50 p-4 rounded-lg mb-4 border-l-4 border-medical-blue-500">
                                        <p className="text-xs text-medical-blue-600 font-bold uppercase tracking-wide mb-1">Hospital Response</p>
                                        <p className="text-sm text-slate-700">{request.hospitalResponse}</p>
                                    </div>
                                )}

                                {/* Additional Notes */}
                                {request.additionalNotes && (
                                    <div className="bg-blue-50 p-4 rounded-lg mb-4 border-l-4 border-blue-400">
                                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wide mb-1">Additional Notes</p>
                                        <p className="text-sm text-slate-700">{request.additionalNotes}</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-5 pt-4 border-t border-slate-200">
                                    {request.isPending && (
                                        <>
                                            <button 
                                                onClick={() => handleApproveClick(request.id)} 
                                                disabled={loading} 
                                                className="btn-success flex items-center gap-2"
                                            >
                                                <span>✅</span>
                                                <span>Approve Request</span>
                                            </button>
                                            <button 
                                                onClick={() => handleRejectClick(request.id)} 
                                                disabled={loading} 
                                                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                                            >
                                                <span>❌</span>
                                                <span>Reject Request</span>
                                            </button>
                                        </>
                                    )}
                                    {request.isApproved && (
                                        <button 
                                            onClick={() => alert('Procurement will be issued. Stock will be delivered to the store.')} 
                                            className="btn-primary flex items-center gap-2"
                                        >
                                            <span>📦</span>
                                            <span>Issue Procurement Order</span>
                                        </button>
                                    )}
                                    {request.isRejected && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg border border-red-200">
                                            <span>❌</span>
                                            <span className="font-semibold">Request was rejected</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showResponseModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl max-w-lg w-full shadow-2xl animate-slide-up">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    responseData.action === 'approve' 
                                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
                                        : 'bg-gradient-to-br from-red-500 to-red-600'
                                }`}>
                                    <span className="text-2xl">{responseData.action === 'approve' ? '✅' : '❌'}</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                        {responseData.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {responseData.action === 'approve' 
                                            ? 'Provide approval details and expected delivery timeline' 
                                            : 'Provide reason for rejection'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <label className="label mb-2">
                                    <span className="flex items-center gap-2">
                                        <span>💬</span>
                                        <span>Response Message</span>
                                    </span>
                                </label>
                                <textarea 
                                    value={responseData.response} 
                                    onChange={(e) => setResponseData({ ...responseData, response: e.target.value })} 
                                    placeholder={responseData.action === 'approve' 
                                        ? 'e.g., Approved. Items will be added to inventory within 3 business days.' 
                                        : 'e.g., Budget constraints. Please resubmit next quarter.'} 
                                    className="input-field resize-none" 
                                    rows="4"
                                />
                            </div>
                            
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => { setShowResponseModal(false); setActiveRequestId(null); setResponseData({}); }} 
                                    className="px-5 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-all duration-200"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSubmitResponse} 
                                    disabled={loading} 
                                    className={`px-5 py-2.5 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 ${
                                        responseData.action === 'approve' 
                                            ? 'bg-emerald-600 hover:bg-emerald-700' 
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {loading ? (
                                        <>
                                            <span className="animate-spin">⏳</span>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{responseData.action === 'approve' ? '✅' : '❌'}</span>
                                            <span>Confirm {responseData.action === 'approve' ? 'Approval' : 'Rejection'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HospitalProcurementDashboard;
