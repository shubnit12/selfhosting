import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { authAPI, userAPI } from '../api/client';
function SettingsPage() {
    const navigate = useNavigate();
     const [user, setUser] = useState<User | null>(null);
         const [qrCode, setQrCode] = useState('');  
    const [secret, setSecret] = useState('');  
    const [backupCodes, setBackupCodes] = useState<string[]>([]);  
    const [twoFAToken, setTwoFAToken] = useState('');  
    const [showSetup, setShowSetup] = useState(false);  
    const [showDisable, setShowDisable] = useState(false);  
const [disableToken, setDisableToken] = useState('');  
const [newUsername, setNewUsername] = useState(''); 
const [newQuota, setNewQuota] = useState('21474836480'); 
const [newEmail, setNewEmail] = useState('');
const [newPassword, setNewPassword] = useState('');
const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
     useEffect(() => {
    userAPI.getMe()
        .then((data) => {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
        })
        .catch(() => {
            const userStr = localStorage.getItem('user');
            if (userStr) setUser(JSON.parse(userStr));
        });
}, []);

        const handleSetup2FA = async () => {
        try {
            const response = await authAPI.setup2FA();
            setQrCode(response.qrCode);
            setSecret(response.secret);
            setBackupCodes(response.backupCodes);
            setShowSetup(true);
            console.log('2FA setup:', response);
        } catch (error) {
            console.error('2FA setup failed:', error);
        }
    };
const handleEnable2FA = async () => {
    if (!twoFAToken || twoFAToken.length !== 6) {
        alert('Please enter 6-digit code');
        return;
    }
     if (!user) return;
    try {
        await authAPI.enable2FA(twoFAToken);
        console.log('2FA enabled successfully');
        
        // Update user state
        const updatedUser: User = { ...user, two_fa_enabled: true };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Reset setup UI
        setShowSetup(false);
        setTwoFAToken('');
        
        alert('2FA enabled successfully!');
    } catch (error) {
        console.error('Enable 2FA failed:', error);
        alert('Invalid token. Please try again.');
    }
};
const handleDisable2FA = async () => {
    if (!disableToken || disableToken.length !== 6) {
        alert('Please enter 6-digit code');
        return;
    }
    if (!user) return;

    try {
        await authAPI.disable2FA(disableToken);
        console.log('2FA disabled successfully');
        
        // Update user state
        const updatedUser: User = { ...user, two_fa_enabled: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Reset UI
        setShowDisable(false);
        setDisableToken('');
        
        alert('2FA disabled successfully!');
    } catch (error) {
        console.error('Disable 2FA failed:', error);
        alert('Invalid token. Please try again.');
    }
};
     if (!user) {
        return <div>Loading...</div>;
    }
    // Calculate storage percentage
    const storagePercentage = user.storage_quota 
        ? Math.round((user.storage_used / user.storage_quota) * 100)
        : 0

         // Format bytes to readable size
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const handleRegisterUser = async () => {
    if (!newUsername || !newEmail || !newPassword) {
        alert('Please fill all fields');
        return;
    }

    try {
        const quota = newRole === 'admin' ? null : parseInt(newQuota);
        await authAPI.register(newUsername, newEmail, newPassword, newRole, quota);
        
        console.log('User created:', newUsername);
        alert(`User ${newUsername} created successfully!`);
        
        // Clear form
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('user');
        setNewQuota('21474836480');
    } catch (error: any) {
        console.error('User registration failed:', error);
        const message = error.response?.data?.error || 'Registration failed';
        alert(message);
    }
};
 
    return (
        <div>
            <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            
            <h1>Settings</h1>
            
            <h2>User Profile</h2>
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role}</p>
            
            <h2>Storage Quota</h2>
            <p><strong>Used:</strong> {formatBytes(user.storage_used)}</p>
            <p><strong>Total:</strong> {user.storage_quota ? formatBytes(user.storage_quota) : 'Unlimited'}</p>
            <p><strong>Percentage:</strong> {storagePercentage}%</p>
            
            {/* Progress bar */}
            <div style={{ 
                width: '100%', 
                height: '20px', 
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${storagePercentage}%`,
                    height: '100%',
                    backgroundColor: storagePercentage > 90 ? '#f44336' : '#4CAF50'
                }} />
            </div>
            
            <h2>Two-Factor Authentication</h2>
            <p><strong>Status:</strong> {user.two_fa_enabled ? 'Enabled ✅' : 'Disabled ❌'}</p>
            {!user.two_fa_enabled && !showSetup && (
                <button onClick={handleSetup2FA}>Setup 2FA</button>
            )}
             {showSetup && (
                <div>
                    <h3>Scan QR Code with Google Authenticator</h3>
                    <img src={qrCode} alt="QR Code" />
                    
                    <h3>Or enter this secret manually:</h3>
                    <p>{secret}</p>
                    
                    <h3>Backup Codes (save these!):</h3>
                    <ul>
                        {backupCodes.map((code, i) => (
                            <li key={i}>{code}</li>
                        ))}
                    </ul>
                    
                    <h3>Verify and Enable</h3>
                    <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={twoFAToken}
                        onChange={(e) => setTwoFAToken(e.target.value)}
                        maxLength={6}
                    />
                    <button onClick={handleEnable2FA}>Enable 2FA</button>

                </div>
            )}
            {user.two_fa_enabled && !showDisable && (
    <button onClick={() => setShowDisable(true)}>Disable 2FA</button>
)}

{showDisable && (
    <div>
        <h3>Disable Two-Factor Authentication</h3>
        <p>Enter your current 2FA code to disable:</p>
        <input
            type="text"
            placeholder="Enter 6-digit code"
            value={disableToken}
            onChange={(e) => setDisableToken(e.target.value)}
            maxLength={6}
        />
        <button onClick={handleDisable2FA}>Confirm Disable</button>
        {' '}
        <button onClick={() => setShowDisable(false)}>Cancel</button>
    </div>
)}

{user.role === 'admin' && (
    <>
        <h2>User Management (Admin)</h2>
        <h3>Create New User</h3>
        
        <input
            type="text"
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
        />
        <br />
        <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
        />
        <br />
        <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
        />
        <br />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
        </select>
        <br />
        {newRole === 'user' && (
            <>
                <input
                    type="number"
                    placeholder="Storage Quota (bytes)"
                    value={newQuota}
                    onChange={(e) => setNewQuota(e.target.value)}
                />
                <p>Default: 20GB (21474836480 bytes)</p>
            </>
        )}
        <br />
        <button onClick={handleRegisterUser}>Create User</button>
    </>
)}
        </div>
    );


    
}

export default SettingsPage;