import { ethers } from 'ethers';
import { useState } from 'react';

const Navigation = ({ account, setAccount, userRole, medicalAsset, escrow, provider }) => {
    const [approving, setApproving] = useState(false);

    const connectHandler = async () => {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = ethers.utils.getAddress(accounts[0])
        setAccount(account);
    }

    const handleApproveEscrow = async () => {
        if (!medicalAsset || !escrow || !provider) {
            alert('Please wait for contracts to load');
            return;
        }

        try {
            setApproving(true);
            const signer = await provider.getSigner();
            
            // Check if already approved
            const isApproved = await medicalAsset.isApprovedForAll(account, escrow.address);
            
            if (isApproved) {
                alert('✅ Escrow contract is already approved for your assets!');
                setApproving(false);
                return;
            }
            
            // Approve escrow to manage all assets
            console.log('Approving escrow contract...');
            const tx = await medicalAsset.connect(signer).setApprovalForAll(escrow.address, true);
            await tx.wait();
            
            alert('✅ Success! Escrow contract can now manage all your assets.');
            
        } catch (error) {
            console.error('Error approving escrow:', error);
            alert('Error: ' + error.message);
        } finally {
            setApproving(false);
        }
    }

    const getRoleName = () => {
        if (!userRole) return 'Not Connected';
        switch(userRole) {
            case 'admin': return 'Hospital Admin';
            case 'store': return 'Store Manager';
            case 'ward': return 'Ward Authority';
            default: return 'User';
        }
    }

    return (
        <nav className="sticky top-0 z-50 w-full bg-gradient-to-r from-medical-blue-600 via-medical-blue-700 to-medical-teal-600 shadow-lg">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md">
                            <span className="text-3xl">🏥</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                Medical Asset Tracker
                            </h1>
                            <p className="text-xs text-medical-blue-100">
                                Hospital Equipment & Medicine Management
                            </p>
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center gap-3">
                        {/* Role Badge */}
                        {userRole && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                <span className="text-lg">
                                    {userRole === 'admin' ? '👨‍⚕️' : userRole === 'store' ? '📦' : '🏥'}
                                </span>
                                <span className="text-sm font-semibold text-white">
                                    {getRoleName()}
                                </span>
                            </div>
                        )}

                        {/* Enable Asset Management Button */}
                        {account && medicalAsset && escrow && (
                            <button
                                type="button"
                                onClick={handleApproveEscrow}
                                disabled={approving}
                                title="Approve escrow contract to manage your assets"
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                    approving 
                                        ? 'bg-slate-400 cursor-not-allowed text-white' 
                                        : 'bg-white text-medical-blue-700 hover:bg-medical-blue-50 shadow-md hover:shadow-lg'
                                }`}
                            >
                                <span>{approving ? '⏳' : '🔓'}</span>
                                <span>{approving ? 'Approving...' : 'Enable Management'}</span>
                            </button>
                        )}

                        {/* Wallet Connection */}
                        {account ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                <div className="w-2 h-2 bg-medical-green-400 rounded-full animate-pulse"></div>
                                <span className="text-sm font-mono font-semibold text-white">
                                    {account.slice(0, 6) + '...' + account.slice(38, 42)}
                                </span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={connectHandler}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-medical-blue-700 hover:bg-medical-blue-50 font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                            >
                                <span>🔗</span>
                                <span>Connect Wallet</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navigation;