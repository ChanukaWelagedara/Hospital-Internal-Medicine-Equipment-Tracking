import { useState } from 'react';

const RequestFromHospital = ({ provider, account, escrow, onClose }) => {
    const [formData, setFormData] = useState({
        itemName: '',
        itemType: 'medicine',
        quantity: '',
        reason: '',
        urgency: 'normal',
        additionalNotes: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const signer = await provider.getSigner();
            
            // Create procurement request on blockchain
            const tx = await escrow.connect(signer).createProcurementRequest(
                formData.itemName,
                formData.itemType,
                formData.quantity,
                formData.reason,
                formData.urgency,
                formData.additionalNotes
            );
            
            await tx.wait();
            
            alert(`Stock request submitted successfully!\n\nItem: ${formData.itemName}\nType: ${formData.itemType}\nQuantity: ${formData.quantity}\nReason: ${formData.reason}\n\nHospital Authority will review and process your request.`);
            
            onClose();
        } catch (error) {
            console.error('Error submitting request:', error);
            alert('Error submitting request: ' + error.message);
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
                maxWidth: '600px',
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
                    Request Stock from Hospital Authority
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '25px' }}>
                    Use this form when items are out of stock or running low. Hospital Authority will review and approve.
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                Item Name *
                            </label>
                            <input
                                type="text"
                                name="itemName"
                                value={formData.itemName}
                                onChange={handleChange}
                                placeholder="e.g., Paracetamol 500mg, Digital Thermometer"
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                Item Type *
                            </label>
                            <select
                                name="itemType"
                                value={formData.itemType}
                                onChange={handleChange}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="medicine">Medicine</option>
                                <option value="equipment">Equipment</option>
                                <option value="supplies">Medical Supplies</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                Required Quantity (units) *
                            </label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder="e.g., 1000"
                                min="1"
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                Reason for Request *
                            </label>
                            <select
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">Select reason...</option>
                                <option value="out_of_stock">Out of Stock</option>
                                <option value="low_stock">Low Stock (below threshold)</option>
                                <option value="high_demand">Increased Demand</option>
                                <option value="expiring">Current Stock Expiring Soon</option>
                                <option value="seasonal">Seasonal Requirement</option>
                                <option value="emergency">Emergency Need</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                Urgency Level *
                            </label>
                            <select
                                name="urgency"
                                value={formData.urgency}
                                onChange={handleChange}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="low">Low - Can wait 1-2 weeks</option>
                                <option value="normal">Normal - Needed within 1 week</option>
                                <option value="high">High - Needed within 2-3 days</option>
                                <option value="critical">Critical - Needed immediately</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
                                Additional Notes
                            </label>
                            <textarea
                                name="additionalNotes"
                                value={formData.additionalNotes}
                                onChange={handleChange}
                                placeholder="Any additional information for Hospital Authority..."
                                rows="3"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ 
                        marginTop: '25px',
                        padding: '15px',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '5px',
                        fontSize: '13px',
                        color: '#0369a1'
                    }}>
                        <strong>📋 Note:</strong> Your request will be sent to Hospital Authority for review and approval. 
                        You will be notified once the stock is added to inventory and ready for issuing.
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{
                            width: '100%',
                            marginTop: '25px',
                            padding: '15px',
                            background: loading ? '#9ca3af' : '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'Submitting Request...' : 'Submit Request to Hospital Authority'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RequestFromHospital;
