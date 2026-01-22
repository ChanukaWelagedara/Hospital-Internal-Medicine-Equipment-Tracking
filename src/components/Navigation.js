import { ethers } from 'ethers';

const Navigation = ({ account, setAccount, userRole }) => {
    const connectHandler = async () => {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = ethers.utils.getAddress(accounts[0])
        setAccount(account);
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
            <ul className='nav__links'>
                <li><a href="#inventory">Inventory</a></li>
                <li><a href="#requests">Issuance Requests</a></li>
                <li><a href="#history">Audit Trail</a></li>
            </ul>

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