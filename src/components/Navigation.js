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
        <nav className="w-full bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                MediHouse
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Hospital Medical Inventory System
                            </p>
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center gap-3">
                        {/* Role Badge */}
                        {userRole && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="w-8 h-8 flex items-center justify-center bg-blue-500 rounded-lg">
                                    <span className="text-white text-sm">
                                        {userRole === 'admin' ? '👨‍⚕️' : userRole === 'store' ? '📦' : '🏥'}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-blue-700">
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
                                        ? 'bg-slate-300 cursor-not-allowed text-slate-600' 
                                        : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg'
                                }`}
                            >
                                <span>{approving ? '⏳' : '🔓'}</span>
                                <span>{approving ? 'Approving...' : 'Enable Management'}</span>
                            </button>
                        )}

                        {/* Wallet Connection */}
                        {account ? (
                            <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
                                <span className="text-sm font-mono font-semibold text-slate-700">
                                    {account.slice(0, 6) + '...' + account.slice(38, 42)}
                                </span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={connectHandler}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
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