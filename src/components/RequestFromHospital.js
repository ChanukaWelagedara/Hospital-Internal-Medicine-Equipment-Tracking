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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 overflow-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 max-w-xl w-full max-h-[90vh] overflow-auto relative shadow-lg">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:text-slate-300"
                    aria-label="Close"
                >
                    <span className="text-2xl">×</span>
                </button>

                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Request Stock from Hospital Authority
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">
                    Use this form when items are out of stock or running low. Hospital Authority will review and approve.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Item Name *</label>
                            <input
                                type="text"
                                name="itemName"
                                value={formData.itemName}
                                onChange={handleChange}
                                placeholder="e.g., Paracetamol 500mg, Digital Thermometer"
                                required
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Item Type *</label>
                            <select
                                name="itemType"
                                value={formData.itemType}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            >
                                <option value="medicine">Medicine</option>
                                <option value="equipment">Equipment</option>
                                <option value="supplies">Medical Supplies</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Required Quantity (units) *</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder="e.g., 1000"
                                min="1"
                                required
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Reason for Request *</label>
                            <select
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
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
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Urgency Level *</label>
                            <select
                                name="urgency"
                                value={formData.urgency}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            >
                                <option value="low">Low - Can wait 1-2 weeks</option>
                                <option value="normal">Normal - Needed within 1 week</option>
                                <option value="high">High - Needed within 2-3 days</option>
                                <option value="critical">Critical - Needed immediately</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Additional Notes</label>
                            <textarea
                                name="additionalNotes"
                                value={formData.additionalNotes}
                                onChange={handleChange}
                                placeholder="Any additional information for Hospital Authority..."
                                rows="3"
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-sky-50 border border-sky-100 rounded-md text-sky-700 text-sm">
                        <strong>📋 Note:</strong> Your request will be sent to Hospital Authority for review and approval. You will be notified once the stock is added to inventory and ready for issuing.
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`mt-6 w-full py-3 rounded-md font-semibold text-white ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}
                    >
                        {loading ? 'Submitting Request...' : 'Submit Request to Hospital Authority'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RequestFromHospital;
