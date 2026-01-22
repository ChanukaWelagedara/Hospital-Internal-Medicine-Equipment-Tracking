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
            const pendingRequestIds = await escrow.getPendingProcurementRequests();
            
            const requestsData = await Promise.all(
                pendingRequestIds.map(async (id) => {
                    const request = await escrow.getProcurementRequest(id);
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
                        isPending: request.isPending
                    };
                })
            );
            
            setProcurementRequests(requestsData);
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
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '10px',
                padding: '30px',
                maxWidth: '1100px',
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
                    📦 Procurement Requests from Store Manager
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '25px' }}>
                    Review and approve stock requests from the Store Manager
                </p>

                {loading && procurementRequests.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        Loading procurement requests...
                    </p>
                ) : procurementRequests.length === 0 ? (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '60px 20px',
                        background: '#f9fafb',
                        borderRadius: '8px'
                    }}>
                        <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '10px' }}>
                            No pending procurement requests
                        </p>
                        <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                            Store Manager hasn't submitted any stock requests yet
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {procurementRequests.map((request) => (
                            <div key={request.id} style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '20px',
                                background: '#ffffff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '18px' }}>
                                            {request.itemName}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                background: '#dbeafe', 
                                                color: '#1e40af',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '500'
                                            }}>
                                                {request.itemType.toUpperCase()}
                                            </span>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                background: getUrgencyColor(request.urgency),
                                                color: 'white',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '500'
                                            }}>
                                                {request.urgency.toUpperCase()}
                                            </span>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                background: '#fef3c7', 
                                                color: '#92400e',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '500'
                                            }}>
                                                {getReasonLabel(request.reason)}
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{
                                        padding: '6px 12px',
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600'
                                    }}>
                                        Request #{request.id}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <strong style={{ color: '#6b7280', fontSize: '13px' }}>Requested Quantity:</strong>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: '600', color: '#333' }}>
                                            {request.quantity} units
                                        </p>
                                    </div>
                                    <div>
                                        <strong style={{ color: '#6b7280', fontSize: '13px' }}>Requested By:</strong>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#333', fontFamily: 'monospace' }}>
                                            {request.storeManager.slice(0, 6)}...{request.storeManager.slice(-4)}
                                        </p>
                                    </div>
                                    <div>
                                        <strong style={{ color: '#6b7280', fontSize: '13px' }}>Request Date:</strong>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#333' }}>
                                            {request.requestTimestamp}
                                        </p>
                                    </div>
                                </div>

                                {request.additionalNotes && (
                                    <div style={{ 
                                        background: '#f9fafb', 
                                        padding: '12px', 
                                        borderRadius: '6px',
                                        marginBottom: '15px'
                                    }}>
                                        <strong style={{ color: '#6b7280', fontSize: '13px' }}>Additional Notes:</strong>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#333' }}>
                                            {request.additionalNotes}
                                        </p>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <button
                                        onClick={() => handleApproveClick(request.id)}
                                        disabled={loading}
                                        style={{
                                            padding: '10px 24px',
                                            background: '#16a34a',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            fontSize: '14px',
                                            opacity: loading ? 0.6 : 1
                                        }}
                                    >
                                        ✓ Approve Request
                                    </button>
                                    <button
                                        onClick={() => handleRejectClick(request.id)}
                                        disabled={loading}
                                        style={{
                                            padding: '10px 24px',
                                            background: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            fontSize: '14px',
                                            opacity: loading ? 0.6 : 1
                                        }}
                                    >
                                        ✗ Reject Request
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Response Modal */}
                {showResponseModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 2000
                    }}>
                        <div style={{
                            background: 'white',
                            padding: '30px',
                            borderRadius: '10px',
                            maxWidth: '500px',
                            width: '90%'
                        }}>
                            <h3 style={{ marginTop: 0, color: '#333' }}>
                                {responseData.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                            </h3>
                            <p style={{ color: '#6b7280', fontSize: '14px' }}>
                                {responseData.action === 'approve' 
                                    ? 'Provide approval details and expected delivery timeline:'
                                    : 'Provide reason for rejection:'}
                            </p>
                            <textarea
                                value={responseData.response}
                                onChange={(e) => setResponseData({ ...responseData, response: e.target.value })}
                                placeholder={responseData.action === 'approve'
                                    ? 'e.g., Approved. Items will be added to inventory within 3 business days.'
                                    : 'e.g., Budget constraints. Please resubmit next quarter.'}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    minHeight: '100px',
                                    fontSize: '14px',
                                    marginBottom: '15px',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setShowResponseModal(false);
                                        setActiveRequestId(null);
                                        setResponseData({});
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#e5e7eb',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitResponse}
                                    disabled={loading}
                                    style={{
                                        padding: '10px 20px',
                                        background: responseData.action === 'approve' ? '#16a34a' : '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        opacity: loading ? 0.6 : 1
                                    }}
                                >
                                    {loading ? 'Processing...' : 'Confirm'}
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
