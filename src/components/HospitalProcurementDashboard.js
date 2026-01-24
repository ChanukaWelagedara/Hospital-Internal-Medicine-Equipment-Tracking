import { useEffect, useState } from 'react';

const HospitalProcurementDashboard = ({ provider, account, escrow, onClose }) => {
    const [procurementRequests, setProcurementRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requestFilter, setRequestFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
            <div className="flex">
                {/* Sidebar */}
                <div className="w-64 bg-white border-r border-slate-200 min-h-screen fixed left-0 top-0 shadow-sm">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Hospital Admin</h3>
                                <p className="text-xs text-slate-500">Dashboard</p>
                            </div>
                        </div>

                        <nav className="space-y-2">
                            <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <span>Procurement Requests</span>
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
                                <h1 className="text-2xl font-bold text-slate-900">Procurement Requests</h1>
                                <p className="text-sm text-slate-600">Review and approve stock requests from Store Manager</p>
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
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Total</p>
                                        <p className="text-3xl font-bold text-slate-900 mt-2">{procurementRequests.length}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Pending</p>
                                        <p className="text-3xl font-bold text-slate-900 mt-2">
                                            {procurementRequests.filter(r => r.isPending).length}
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
                                        <p className="text-sm text-slate-600 font-medium">Approved</p>
                                        <p className="text-3xl font-bold text-slate-900 mt-2">
                                            {procurementRequests.filter(r => r.isApproved).length}
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
                                        <p className="text-sm text-slate-600 font-medium">Rejected</p>
                                        <p className="text-3xl font-bold text-slate-900 mt-2">
                                            {procurementRequests.filter(r => r.isRejected).length}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-3 mb-6">
                            <button
                                onClick={() => setRequestFilter('pending')}
                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                    requestFilter === 'pending'
                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            >
                                Pending ({procurementRequests.filter(r => r.isPending).length})
                            </button>
                            <button
                                onClick={() => setRequestFilter('approved')}
                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                    requestFilter === 'approved'
                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            >
                                Approved ({procurementRequests.filter(r => r.isApproved).length})
                            </button>
                            <button
                                onClick={() => setRequestFilter('rejected')}
                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                    requestFilter === 'rejected'
                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            >
                                Rejected ({procurementRequests.filter(r => r.isRejected).length})
                            </button>
                            <button
                                onClick={() => setRequestFilter('all')}
                                className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                                    requestFilter === 'all'
                                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500'
                                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            >
                                All ({procurementRequests.length})
                            </button>
                        </div>

                        </div>

                {loading && procurementRequests.length === 0 ? (
                    <div className="flex items-center justify-center gap-3 p-12 bg-blue-50 rounded-xl border border-blue-200">
                        <span className="animate-spin text-lg">⏳</span>
                        <span className="text-blue-700 font-medium">Loading procurement requests...</span>
                    </div>
                ) : procurementRequests.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <p className="text-slate-600 font-medium">No Procurement Requests</p>
                        <p className="text-sm text-slate-400 mt-1">Store Manager hasn't submitted any stock requests yet</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {(() => {
                            const filteredRequests = procurementRequests.filter(request => {
                                if (requestFilter === 'pending') return request.isPending;
                                if (requestFilter === 'approved') return request.isApproved;
                                if (requestFilter === 'rejected') return request.isRejected;
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
                                        {requestFilter === 'pending' ? 'All Clear!' : 
                                         requestFilter === 'approved' ? 'No Approved Requests' : 
                                         requestFilter === 'rejected' ? 'No Rejected Requests' : 
                                         'No Requests'}
                                    </p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {requestFilter === 'pending' ? 'No pending requests to review at the moment' :
                                         requestFilter === 'approved' ? 'No requests have been approved yet' :
                                         requestFilter === 'rejected' ? 'No requests have been rejected' :
                                         'No procurement requests in the system'}
                                    </p>
                                </div>
                            ) : (
                                filteredRequests.map((request) => (
                            <div key={request.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-all duration-200">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {request.itemType === 'medicine' ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                )}
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{request.itemName}</h3>
                                            <div className="flex gap-2 flex-wrap mt-1">
                                                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                                    {request.itemType.toUpperCase()}
                                                </span>
                                                <span 
                                                    className="px-2.5 py-0.5 text-xs font-semibold rounded-full text-white"
                                                    style={{ background: getUrgencyColor(request.urgency) }}
                                                >
                                                    {request.urgency.toUpperCase()}
                                                </span>
                                                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                                                    {getReasonLabel(request.reason)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                            Request #{request.id}
                                        </span>
                                        {request.isApproved && (
                                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Approved
                                            </span>
                                        )}
                                        {request.isRejected && (
                                            <span className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                                Rejected
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">, <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                        <div className="w-8 h-8 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Requested Quantity</p>
                                            <p className="text-sm font-bold text-slate-900">{request.quantity} units</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Requested By</p>
                                            <p className="text-xs font-mono font-semibold text-slate-800">{request.storeManager.slice(0, 6)}...{request.storeManager.slice(-4)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Request Date</p>
                                            <p className="text-xs font-semibold text-slate-800">{request.requestTimestamp}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Approval Timestamp */}
                                {request.approvedTimestamp && (
                                    <div className="p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500 mb-4 flex items-center gap-3">
                                        <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-800">Approved</p>
                                            <p className="text-xs text-emerald-700">{request.approvedTimestamp}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Hospital Response */}
                                {request.hospitalResponse && (
                                    <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 mb-4">
                                        <p className="text-xs text-blue-600 font-semibold mb-1">HOSPITAL RESPONSE</p>
                                        <p className="text-sm text-slate-700">{request.hospitalResponse}</p>
                                    </div>
                                )}

                                {/* Additional Notes */}
                                {request.additionalNotes && (
                                    <div className="p-4 bg-slate-50 rounded-lg border-l-4 border-slate-400 mb-4">
                                        <p className="text-xs text-slate-600 font-semibold mb-1">ADDITIONAL NOTES</p>
                                        <p className="text-sm text-slate-700">{request.additionalNotes}</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {request.isPending && (
                                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                                        <button 
                                            onClick={() => handleApproveClick(request.id)} 
                                            disabled={loading} 
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Approve Request</span>
                                        </button>
                                        <button 
                                            onClick={() => handleRejectClick(request.id)} 
                                            disabled={loading} 
                                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                            <span>Reject Request</span>
                                        </button>
                                    </div>
                                )}
                                {request.isApproved && (
                                    <div className="pt-4 border-t border-slate-200">
                                        <div className="p-4 bg-emerald-50 rounded-lg flex items-center gap-3">
                                            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-sm font-semibold text-emerald-700">Request has been approved</p>
                                        </div>
                                    </div>
                                )}
                                {request.isRejected && (
                                    <div className="pt-4 border-t border-slate-200">
                                        <div className="p-4 bg-red-50 rounded-lg flex items-center gap-3">
                                            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-sm font-semibold text-red-700">Request was rejected</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                        );
                        })()}
                    </div>
                )}
                </div>
            </div>

                {/* Response Modal */}
                {showResponseModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    responseData.action === 'approve' 
                                        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100' 
                                        : 'bg-gradient-to-br from-red-50 to-red-100'
                                }`}>
                                    <svg className={`w-6 h-6 ${responseData.action === 'approve' ? 'text-emerald-600' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                                        {responseData.action === 'approve' ? (
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        ) : (
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        )}
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">
                                        {responseData.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                                    </h3>
                                    <p className="text-sm text-slate-600">
                                        {responseData.action === 'approve' 
                                            ? 'Provide approval details and expected delivery timeline' 
                                            : 'Provide reason for rejection'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Response Message
                                </label>
                                <textarea 
                                    value={responseData.response} 
                                    onChange={(e) => setResponseData({ ...responseData, response: e.target.value })} 
                                    placeholder={responseData.action === 'approve' 
                                        ? 'e.g., Approved. Items will be added to inventory within 3 business days.' 
                                        : 'e.g., Budget constraints. Please resubmit next quarter.'} 
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    rows="4"
                                />
                            </div>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => { setShowResponseModal(false); setActiveRequestId(null); setResponseData({}); }} 
                                    className="px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-all duration-200"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSubmitResponse} 
                                    disabled={loading} 
                                    className={`flex-1 px-6 py-3 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                                        responseData.action === 'approve' 
                                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800' 
                                            : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                {responseData.action === 'approve' ? (
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                ) : (
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                )}
                                            </svg>
                                            <span>Confirm {responseData.action === 'approve' ? 'Approval' : 'Rejection'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default HospitalProcurementDashboard;
