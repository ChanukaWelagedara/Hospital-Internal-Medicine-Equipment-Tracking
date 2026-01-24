import { useState } from 'react';

const AddMedicine = ({ provider, account, medicalAsset, escrow, onClose, onMedicineAdded }) => {
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

            // Approve escrow contract to manage this asset
            if (escrow) {
                const escrowAddress = escrow.address;
                const approvalTx = await medicalAsset.connect(signer).setApprovalForAll(escrowAddress, true);
                await approvalTx.wait();
                console.log('Escrow contract approved to manage assets');
            }

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 overflow-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto relative shadow-lg">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:text-slate-300">×</button>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Add New Hospital Asset</h2>

                <div className="mb-4 flex gap-3 justify-center">
                    <button
                        type="button"
                        onClick={() => setAssetType('medicine')}
                        className={`px-6 py-2 rounded-md font-semibold ${assetType === 'medicine' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}
                    >
                        Medicine
                    </button>
                    <button
                        type="button"
                        onClick={() => setAssetType('equipment')}
                        className={`px-6 py-2 rounded-md font-semibold ${assetType === 'equipment' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}
                    >
                        Equipment
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{assetType === 'medicine' ? 'Medicine' : 'Equipment'} Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., Paracetamol 500mg' : 'e.g., Digital Thermometer'}
                                required
                                className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{assetType === 'medicine' ? 'Batch ID' : 'Serial Number'} *</label>
                            <input
                                type="text"
                                name={assetType === 'medicine' ? 'batchId' : 'serialNumber'}
                                value={assetType === 'medicine' ? formData.batchId : formData.serialNumber}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., PAR-2026-001-A' : 'e.g., DTH-2026-001'}
                                required
                                className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Total Quantity (units) *</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., 10000' : 'e.g., 50'}
                                min="1"
                                required
                                className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Manufacturer Name *</label>
                            <input
                                type="text"
                                name="manufacturer"
                                value={formData.manufacturer}
                                onChange={handleChange}
                                placeholder={assetType === 'medicine' ? 'e.g., PharmaCorp Industries' : 'e.g., MediTech Solutions'}
                                required
                                className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        {assetType === 'medicine' ? (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Expiry Date *</label>
                                    <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Medicine Type *</label>
                                    <input type="text" name="medicineType" value={formData.medicineType} onChange={handleChange} placeholder="e.g., Analgesic, Antibiotic" required className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Storage Temperature</label>
                                    <input type="text" name="storageTemp" value={formData.storageTemp} onChange={handleChange} placeholder="e.g., 15-25°C" className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Active Ingredient</label>
                                    <input type="text" name="activeIngredient" value={formData.activeIngredient} onChange={handleChange} placeholder="e.g., Paracetamol 500mg" className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Dosage Form</label>
                                    <input type="text" name="dosageForm" value={formData.dosageForm} onChange={handleChange} placeholder="e.g., Tablet, Capsule" className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Equipment Type *</label>
                                    <input type="text" name="equipmentType" value={formData.equipmentType} onChange={handleChange} placeholder="e.g., Diagnostic, Surgical" required className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Model *</label>
                                    <input type="text" name="model" value={formData.model} onChange={handleChange} placeholder="e.g., X-2000 Pro" required className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Calibration Date</label>
                                    <input type="date" name="calibrationDate" value={formData.calibrationDate} onChange={handleChange} className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                                </div>
                            </>
                        )}

                        <div className="md:col-span-2 flex flex-col">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Description *</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} placeholder={assetType === 'medicine' ? 'Enter medicine description...' : 'Enter equipment description...'} rows="3" required className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className={`w-full py-3 rounded-md font-semibold text-white ${loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {loading ? `Adding ${assetType}...` : `Add ${assetType === 'medicine' ? 'Medicine' : 'Equipment'}`}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddMedicine;
