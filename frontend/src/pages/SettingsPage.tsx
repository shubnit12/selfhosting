
import './SettingsPage.css';
import './Dashboard.css';
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
    <div className="settings-page">
        <header className="settings-header">
            <button className="header-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
            <h1>⚙ Settings</h1>
        </header>

        <main className="settings-main">

            {/* Profile card */}
            <div className="settings-card">
                <p className="settings-card-title">User Profile</p>
                <div className="settings-row"><span className="settings-label">Username</span>{user.username}</div>
                <div className="settings-row"><span className="settings-label">Email</span>{user.email}</div>
                <div className="settings-row"><span className="settings-label">Role</span>{user.role}</div>
            </div>

            {/* Storage card */}
            <div className="settings-card">
                <p className="settings-card-title">Storage</p>
                <div className="settings-row"><span className="settings-label">Used</span>{formatBytes(user.storage_used)}</div>
                <div className="settings-row"><span className="settings-label">Total</span>{user.storage_quota ? formatBytes(user.storage_quota) : 'Unlimited'}</div>
                <div className="storage-bar-track">
                    <div
                        className={`storage-bar-fill${storagePercentage > 90 ? ' danger' : storagePercentage > 70 ? ' warning' : ''}`}
                        style={{ width: `${storagePercentage}%` }}
                    />
                </div>
                <div className="settings-row" style={{ fontSize: '0.75rem', color: '#6b5c3e' }}>{storagePercentage}% used</div>
            </div>

            {/* 2FA card */}
            <div className="settings-card">
                <p className="settings-card-title">Two-Factor Authentication</p>
                <div className="settings-row">
                    <span className="settings-label">Status</span>
                    <span className={`twofa-badge ${user.two_fa_enabled ? 'twofa-badge-on' : 'twofa-badge-off'}`}>
                        {user.two_fa_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>

                {!user.two_fa_enabled && !showSetup && (
                    <button className="upload-btn" onClick={handleSetup2FA}>Setup 2FA</button>
                )}

                {showSetup && (
                    <div className="settings-form">
                        <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>Scan QR Code with Google Authenticator:</p>
                        <img src={qrCode} alt="QR Code" style={{ width: '160px', height: '160px', border: '2px solid #2d2d2d' }} />
                        <p style={{ fontSize: '0.8rem' }}>Or enter secret manually: <strong>{secret}</strong></p>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>Backup Codes (save these!):</p>
                        <ul className="backup-codes-list">
                            {backupCodes.map((code, i) => <li key={i}>{code}</li>)}
                        </ul>
                        <input className="sidebar-input" type="text" placeholder="Enter 6-digit code" value={twoFAToken} onChange={(e) => setTwoFAToken(e.target.value)} maxLength={6} />
                        <button className="upload-btn" onClick={handleEnable2FA}>Enable 2FA</button>
                    </div>
                )}

                {user.two_fa_enabled && !showDisable && (
                    <button className="upload-btn" style={{ background: '#c0392b', borderColor: '#c0392b' }} onClick={() => setShowDisable(true)}>Disable 2FA</button>
                )}

                {showDisable && (
                    <div className="settings-form">
                        <p style={{ fontSize: '0.8rem' }}>Enter your current 2FA code to disable:</p>
                        <input className="sidebar-input" type="text" placeholder="Enter 6-digit code" value={disableToken} onChange={(e) => setDisableToken(e.target.value)} maxLength={6} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="upload-btn" style={{ background: '#c0392b', borderColor: '#c0392b' }} onClick={handleDisable2FA}>Confirm Disable</button>
                            <button className="file-input-btn" onClick={() => setShowDisable(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Admin — create user */}
            {user.role === 'admin' && (
                <div className="settings-card">
                    <p className="settings-card-title">Create New User (Admin)</p>
                    <div className="settings-form">
                        <input className="sidebar-input" type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                        <input className="sidebar-input" type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                        <input className="sidebar-input" type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        <select className="settings-select" value={newRole} onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        {newRole === 'user' && (
                            <>
                                <input className="sidebar-input" type="number" placeholder="Storage Quota (bytes)" value={newQuota} onChange={(e) => setNewQuota(e.target.value)} />
                                <p style={{ fontSize: '0.72rem', color: '#6b5c3e' }}>Default: 20GB (21474836480 bytes)</p>
                            </>
                        )}
                        <button className="upload-btn" onClick={handleRegisterUser}>Create User</button>
                    </div>
                </div>
            )}

        </main>
    </div>
);



}

export default SettingsPage;
