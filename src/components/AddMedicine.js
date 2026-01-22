import { useState } from 'react';
import '../AddMedicine.css';

const AddMedicine = ({ provider, account, medicalAsset, onClose, onMedicineAdded }) => {
    const [assetType, setAssetType] = useState('medicine'); // 'medicine' or 'equipment'
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        quantity: '',
        batchId: '',
        manufacturer: '',
        expiryDate: '',
        medicineType: '',
        storageTemp: '',
        activeIngredient: '',
        dosageForm: '',
        // Equipment specific
        equipmentType: '',
        model: '',
        serialNumber: '',
        calibrationDate: ''
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
            // Create metadata object based on asset type
            let metadata;
            
            if (assetType === 'medicine') {
                metadata = {
                    name: formData.name,
                    description: formData.description,
                    itemType: "Medicine",
                    attributes: [
                        { trait_type: "Item Type", value: "Medicine" },
                        { trait_type: "Total Quantity", value: parseInt(formData.quantity) },
                        { trait_type: "Batch ID", value: formData.batchId },
                        { trait_type: "Manufacturer", value: formData.manufacturer },
                        { trait_type: "Expiry Date", value: formData.expiryDate },
                        { trait_type: "Medicine Type", value: formData.medicineType },
                        { trait_type: "Storage Temperature", value: formData.storageTemp },
                        { trait_type: "Active Ingredient", value: formData.activeIngredient },
                        { trait_type: "Dosage Form", value: formData.dosageForm }
                    ]
                };
            } else {
                metadata = {
                    name: formData.name,
                    description: formData.description,
                    itemType: "Equipment",
                    attributes: [
                        { trait_type: "Item Type", value: "Equipment" },
                        { trait_type: "Total Quantity", value: parseInt(formData.quantity) },
                        { trait_type: "Serial Number", value: formData.serialNumber || formData.batchId },
                        { trait_type: "Manufacturer", value: formData.manufacturer },
                        { trait_type: "Equipment Type", value: formData.equipmentType },
                        { trait_type: "Model", value: formData.model },
                        { trait_type: "Calibration Date", value: formData.calibrationDate }
                    ]
                };
            }

            // Convert metadata to JSON string
            const metadataString = JSON.stringify(metadata, null, 2);
            
            // Create a data URL (in production, upload to IPFS)
            const dataUrl = `data:application/json;base64,${btoa(metadataString)}`;

            // Mint the asset NFT using the NEW mintAsset function
            // itemType: 0 = Medicine, 1 = Equipment
            const itemTypeEnum = assetType === 'medicine' ? 0 : 1;
            
            const signer = await provider.getSigner();
            const transaction = await medicalAsset.connect(signer).mintAsset(
                dataUrl,
                parseInt(formData.quantity),
                itemTypeEnum
            );
            
            await transaction.wait();

            alert(`${assetType === 'medicine' ? 'Medicine' : 'Equipment'} added successfully!`);
            
            // Notify parent component to refresh
            if (onMedicineAdded) {
                onMedicineAdded();
            }
            
            onClose();
        } catch (error) {
            console.error('Error adding asset:', error);
            alert('Error adding asset: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="add-medicine-modal">
            <div className="add-medicine-content">
                <button className="close-btn" onClick={onClose}>×</button>
                <h2>Add New Hospital Asset</h2>
                
                {/* Asset Type Selector */}
                <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setAssetType('medicine')}
                        style={{
                            padding: '10px 30px',
                            background: assetType === 'medicine' ? '#10b981' : '#e5e7eb',
                            color: assetType === 'medicine' ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Medicine
                    </button>
                    <button
                        type="button"
                        onClick={() => setAssetType('equipment')}
                        style={{
                            padding: '10px 30px',
                            background: assetType === 'equipment' ? '#10b981' : '#e5e7eb',
                            color: assetType === 'equipment' ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Equipment
                    </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>{assetType === 'medicine' ? 'Medicine' : 'Equipment'} Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., Paracetamol 500mg' : 'e.g., Digital Thermometer'}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>{assetType === 'medicine' ? 'Batch ID' : 'Serial Number'} *</label>
                            <input
                                type="text"
                                name={assetType === 'medicine' ? 'batchId' : 'serialNumber'}
                                value={assetType === 'medicine' ? formData.batchId : formData.serialNumber}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., PAR-2026-001-A' : 'e.g., DTH-2026-001'}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Total Quantity (units) *</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., 10000' : 'e.g., 50'}
                                min="1"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Manufacturer Name *</label>
                            <input
                                type="text"
                                name="manufacturer"
                                value={formData.manufacturer}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., PharmaCorp Industries' : 'e.g., MediTech Solutions'}
                                required
                            />
                        </div>

                        {assetType === 'medicine' ? (
                            <>
                                <div className="form-group">
                                    <label>Expiry Date *</label>
                                    <input
                                        type="date"
                                        name="expiryDate"
                                        value={formData.expiryDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Medicine Type *</label>
                                    <input
                                        type="text"
                                        name="medicineType"
                                        value={formData.medicineType}
                                        onChange={handleChange}
                                        placeholder="e.g., Analgesic, Antibiotic"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Storage Temperature</label>
                                    <input
                                        type="text"
                                        name="storageTemp"
                                        value={formData.storageTemp}
                                        onChange={handleChange}
                                        placeholder="e.g., 15-25°C"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Active Ingredient</label>
                                    <input
                                        type="text"
                                        name="activeIngredient"
                                        value={formData.activeIngredient}
                                        onChange={handleChange}
                                        placeholder="e.g., Paracetamol 500mg"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Dosage Form</label>
                                    <input
                                        type="text"
                                        name="dosageForm"
                                        value={formData.dosageForm}
                                        onChange={handleChange}
                                        placeholder="e.g., Tablet, Capsule"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>Equipment Type *</label>
                                    <input
                                        type="text"
                                        name="equipmentType"
                                        value={formData.equipmentType}
                                        onChange={handleChange}
                                        placeholder="e.g., Diagnostic, Surgical"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Model *</label>
                                    <input
                                        type="text"
                                        name="model"
                                        value={formData.model}
                                        onChange={handleChange}
                                        placeholder="e.g., X-2000 Pro"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Calibration Date</label>
                                    <input
                                        type="date"
                                        name="calibrationDate"
                                        value={formData.calibrationDate}
                                        onChange={handleChange}
                                    />
                                </div>
                            </>
                        )}

                        <div className="form-group full-width">
                            <label>Description *</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'Enter medicine description...' : 'Enter equipment description...'}
                                rows="3"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? `Adding ${assetType}...` : `Add ${assetType === 'medicine' ? 'Medicine' : 'Equipment'}`}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddMedicine;
