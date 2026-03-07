import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI, userAPI } from '../api/client';
import type { User } from '../types';
function AdminPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
const [loading, setLoading] = useState(false);
     const [user, setUser] = useState<User | null>(null);
const [newUsername, setNewUsername] = useState(''); 
const [newQuota, setNewQuota] = useState('21474836480'); 
const [newEmail, setNewEmail] = useState('');
const [newPassword, setNewPassword] = useState('');
const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
const [error, setError] = useState('');
const fetchUsers = async () => {
    setLoading(true);
    try {
        const result = await userAPI.getAll();
        setUsers(result.users);
    } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load users');
    } finally {
        setLoading(false);
    }
};

     useEffect(() => {
        // Load user info from localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            setUser(JSON.parse(userStr));
        }
    }, []);
const handleUpdateQuota = async (userId: string, username: string, currentQuota: number | null) => {
    const input = prompt(`New quota for ${username} in GB (leave empty for unlimited):`, currentQuota ? String(Math.round(currentQuota / (1024**3))) : '');
    if (input === null) return;
    const quota = input.trim() === '' ? null : parseInt(input) * 1024 * 1024 * 1024;
    try {
        await userAPI.updateQuota(userId, quota);
        alert('Quota updated!');
        fetchUsers();
    } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to update quota');
    }
};

const handleDeactivate = async (userId: string, username: string) => {
    if (!confirm(`Deactivate user "${username}"? They will not be able to login.`)) return;
    try {
        await userAPI.deactivate(userId);
        alert(`${username} deactivated.`);
        fetchUsers();
    } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to deactivate');
    }
};

const handleRestore = async (userId: string, username: string) => {
    if (!confirm(`Restore user "${username}"?`)) return;
    try {
        await userAPI.restore(userId);
        alert(`${username} restored.`);
        fetchUsers();
    } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to restore');
    }
};
const formatBytes = (bytes: number) => (bytes / (1024 ** 3)).toFixed(2) + ' GB';

const handlePermanentDelete = async (userId: string, username: string) => {
    if (!confirm(`PERMANENTLY delete "${username}" and ALL their data? This cannot be undone!`)) return;
    if (!confirm(`Are you absolutely sure? All files, folders and share links will be deleted.`)) return;
    try {
        const result = await userAPI.permanentDelete(userId);
        alert(`${username} permanently deleted!\n\nFiles deleted: ${result.stats.files_deleted}\nFolders deleted: ${result.stats.folders_deleted}\nStorage freed: ${formatBytes(result.stats.storage_freed)}\nShare links deactivated: ${result.stats.share_links_deactivated}`);

        fetchUsers();
    } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to permanently delete');
    }
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

const handleCleanup = async () => {
    if (!confirm('Run all cleanup tasks? This may take a moment.')) return;
    try {
        const result = await userAPI.triggerCleanup();
        alert(
    `Cleanup done!\n\n` +
    `Orphaned files: ${result.results.orphanedFiles.filesDeleted} (${formatBytes(result.results.orphanedFiles.storageFreed)} freed)\n` +
    `Expired sessions: ${result.results.expiredSessions.sessionsDeleted} (${result.results.expiredSessions.chunksDeleted} chunks deleted)\n` +
    `Orphaned thumbnails: ${result.results.orphanedThumbnails.thumbnailsDeleted}\n` +
    `Unreferenced files: ${result.results.unreferencedFiles.filesDeleted} (${formatBytes(result.results.unreferencedFiles.storageFreed)} freed)\n` +
    `Trashed files: ${result.results.trashedFiles.filesDeleted} (${formatBytes(result.results.trashedFiles.storageFreed)} freed)\n` +
    `Trashed folders: ${result.results.trashedFolders.foldersDeleted}\n` +
    `Missing Thumbnails: ${result.results.missingThumbnails.jobsQueued}\n` +
    `Inactive users deleted: ${result.results.inactiveUsers.usersDeleted} (${result.results.inactiveUsers.filesDeleted} files, ${formatBytes(result.results.inactiveUsers.storageFreed)} freed)`
    
);
    } catch (err: any) {
        alert(err.response?.data?.error || 'Cleanup failed');
    }
};
useEffect(() => {
    fetchUsers();
}, []);
    return (
    <div>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        <h1>Admin Panel</h1>

        <button onClick={handleCleanup}>Run Cleanup Tasks</button>

        <h2>Users</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {loading ? <p>Loading...</p> : (
            <table border={1} cellPadding={8}>
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Storage Used</th>
                        <th>Quota</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td>{u.username}</td>
                            <td>{u.email}</td>
                            <td>{u.role}</td>
                            <td>{(u.storage_used / (1024 ** 3)).toFixed(2)} GB</td>
                            <td>{u.storage_quota ? `${(u.storage_quota / (1024 ** 3)).toFixed(2)} GB` : 'Unlimited'}</td>
                            <td>{u.is_active === false ? '🔴 Inactive' : '🟢 Active'}</td>
                            <td>
                                <button onClick={() => handleUpdateQuota(u.id, u.username, u.storage_quota)}>Quota</button>
                                {' '}
                                {u.is_active !== false
                                    ? <button onClick={() => handleDeactivate(u.id, u.username)}>Deactivate</button>
                                    : <button onClick={() => handleRestore(u.id, u.username)}>Restore</button>
                                }
                                {' '}
                                <button onClick={() => handlePermanentDelete(u.id, u.username)} style={{ color: 'red' }}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
        <div>
            {user?.role === 'admin' && (
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
    </div>
    
);
}

export default AdminPage;