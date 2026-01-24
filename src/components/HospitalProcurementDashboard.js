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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 overflow-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-7xl w-full max-h-[90vh] overflow-auto relative shadow-xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:text-slate-300">×</button>

                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">📦 Procurement Requests from Store Manager</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">Review and approve stock requests from the Store Manager</p>

                {loading && procurementRequests.length === 0 ? (
                    <p className="text-center p-10 text-slate-500">Loading procurement requests...</p>
                ) : procurementRequests.length === 0 ? (
                    <div className="text-center p-12 bg-slate-50 dark:bg-slate-700 rounded-md">
                        <p className="text-lg text-slate-500 mb-2">No pending procurement requests</p>
                        <p className="text-sm text-slate-400">Store Manager hasn't submitted any stock requests yet</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {procurementRequests.map((request) => (
                            <div key={request.id} className="border rounded-md p-4 bg-white dark:bg-slate-700 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{request.itemName}</h3>
                                        <div className="flex gap-2 flex-wrap mb-2">
                                            <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-700">{request.itemType.toUpperCase()}</span>
                                            <span className="px-2 py-1 rounded-full text-xs" style={{background: getUrgencyColor(request.urgency), color: 'white'}}>{request.urgency.toUpperCase()}</span>
                                            <span className="px-2 py-1 rounded-full text-xs bg-amber-50 text-amber-700">{getReasonLabel(request.reason)}</span>
                                            <span className="px-2 py-1 rounded-full text-xs" style={{background: request.statusColor, color: 'white'}}>{request.statusIcon} {request.status}</span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-100 font-semibold">Request #{request.id}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <strong className="text-xs text-slate-500">Requested Quantity:</strong>
                                        <p className="mt-1 text-lg font-semibold text-slate-900">{request.quantity} units</p>
                                    </div>
                                    <div>
                                        <strong className="text-xs text-slate-500">Requested By:</strong>
                                        <p className="mt-1 text-sm font-mono text-slate-900">{request.storeManager.slice(0, 6)}...{request.storeManager.slice(-4)}</p>
                                    </div>
                                    <div>
                                        <strong className="text-xs text-slate-500">Request Date:</strong>
                                        <p className="mt-1 text-sm text-slate-900">{request.requestTimestamp}</p>
                                    </div>
                                </div>

                                {request.approvedTimestamp && (
                                    <div className="bg-emerald-50 p-3 rounded-md mb-3 border border-emerald-200">
                                        <strong className="text-sm text-emerald-700">✓ Approved on:</strong>
                                        <p className="mt-1 text-sm text-emerald-800">{request.approvedTimestamp}</p>
                                    </div>
                                )}

                                {request.hospitalResponse && (
                                    <div className="bg-slate-50 p-3 rounded-md mb-3">
                                        <strong className="text-sm text-slate-500">Hospital Response:</strong>
                                        <p className="mt-1 text-sm text-slate-900">{request.hospitalResponse}</p>
                                    </div>
                                )}

                                {request.additionalNotes && (
                                    <div className="bg-slate-50 p-3 rounded-md mb-3">
                                        <strong className="text-sm text-slate-500">Additional Notes:</strong>
                                        <p className="mt-1 text-sm text-slate-900">{request.additionalNotes}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-2">
                                    {request.isPending && (
                                        <>
                                            <button onClick={() => handleApproveClick(request.id)} disabled={loading} className="px-4 py-2 rounded-md bg-emerald-600 text-white font-semibold">✓ Approve Request</button>
                                            <button onClick={() => handleRejectClick(request.id)} disabled={loading} className="px-4 py-2 rounded-md bg-rose-600 text-white font-semibold">✗ Reject Request</button>
                                        </>
                                    )}
                                    {request.isApproved && (
                                        <button onClick={() => alert('Procurement will be issued. Stock will be delivered to the store.')} className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold">📦 Issue Procurement Order</button>
                                    )}
                                    {request.isRejected && (
                                        <span className="px-4 py-2 rounded-md bg-rose-50 text-rose-700 font-semibold">Request was rejected</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showResponseModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-md max-w-lg w-full">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{responseData.action === 'approve' ? 'Approve Request' : 'Reject Request'}</h3>
                            <p className="text-sm text-slate-500 mb-3">{responseData.action === 'approve' ? 'Provide approval details and expected delivery timeline:' : 'Provide reason for rejection:'}</p>
                            <textarea value={responseData.response} onChange={(e) => setResponseData({ ...responseData, response: e.target.value })} placeholder={responseData.action === 'approve' ? 'e.g., Approved. Items will be added to inventory within 3 business days.' : 'e.g., Budget constraints. Please resubmit next quarter.'} className="w-full p-3 border rounded-md min-h-[100px] mb-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setShowResponseModal(false); setActiveRequestId(null); setResponseData({}); }} className="px-4 py-2 rounded-md bg-slate-200">Cancel</button>
                                <button onClick={handleSubmitResponse} disabled={loading} className={`px-4 py-2 rounded-md text-white ${responseData.action === 'approve' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{loading ? 'Processing...' : 'Confirm'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HospitalProcurementDashboard;
