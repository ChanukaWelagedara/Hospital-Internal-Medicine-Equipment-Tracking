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
        <nav>
            <div className='nav__brand'>
                <span style={{ fontSize: '32px', marginRight: '10px' }}>🏥</span>
                <h1>Hospital Asset Tracker</h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {userRole && (
                    <span style={{ 
                        padding: '8px 12px', 
                        background: '#10b981', 
                        color: 'white',
                        borderRadius: '5px',
                        fontSize: '14px',
                        fontWeight: '600'
                    }}>
                        {getRoleName()}
                    </span>
                )}
                {account && medicalAsset && escrow && (
                    <button
                        type="button"
                        onClick={handleApproveEscrow}
                        disabled={approving}
                        style={{
                            padding: '8px 16px',
                            background: approving ? '#9ca3af' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: approving ? 'not-allowed' : 'pointer'
                        }}
                        title="Approve escrow contract to manage your assets"
                    >
                        {approving ? '⏳ Approving...' : '🔓 Enable Asset Management'}
                    </button>
                )}
                {account ? (
                    <button
                        type="button"
                        className='nav__connect'
                        title={account}
                    >
                        {account.slice(0, 6) + '...' + account.slice(38, 42)}
                    </button>
                ) : (
                    <button
                        type="button"
                        className='nav__connect'
                        onClick={connectHandler}
                    >
                        Connect
                    </button>
                )}
            </div>
        </nav>
    );
}

export default Navigation;