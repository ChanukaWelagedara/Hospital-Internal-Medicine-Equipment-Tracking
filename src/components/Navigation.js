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
        <nav className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🏥</span>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Hospital Asset Tracker</h1>
                </div>

                <div className="flex items-center gap-3">
                    {userRole && (
                        <span className="px-3 py-1 rounded-md bg-emerald-500 text-white text-sm font-semibold">
                            {getRoleName()}
                        </span>
                    )}

                    {account && medicalAsset && escrow && (
                        <button
                            type="button"
                            onClick={handleApproveEscrow}
                            disabled={approving}
                            title="Approve escrow contract to manage your assets"
                            className={`px-3 py-2 rounded-md text-sm font-semibold text-white ${approving ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {approving ? '⏳ Approving...' : '🔓 Enable Asset Management'}
                        </button>
                    )}

                    {account ? (
                        <button
                            type="button"
                            title={account}
                            className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
                        >
                            {account.slice(0, 6) + '...' + account.slice(38, 42)}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={connectHandler}
                            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                        >
                            Connect
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navigation;