import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shareAPI } from '../api/client';
import './ShareLinksPage.css';
import './Dashboard.css';

function ShareLinksPage() {
    const navigate = useNavigate();
    const [links, setLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
const [editLink, setEditLink] = useState<any>(null);
const [editExpiry, setEditExpiry] = useState('');
const [editMaxDownloads, setEditMaxDownloads] = useState('');
const [editPassword, setEditPassword] = useState('');
const [editActive, setEditActive] = useState(true);
const handleEdit = (link: any) => {
    setEditLink(link);
    setEditExpiry(link.expires_at ? new Date(link.expires_at).toISOString().split('T')[0] : '');
    setEditMaxDownloads(link.max_downloads ? String(link.max_downloads) : '');
    setEditPassword('');
    setEditActive(link.is_active);
};

const handleSaveEdit = async () => {
    if (!editLink) return;
    try {
        await shareAPI.update(editLink.id, {
expires_at: editExpiry ? new Date(editExpiry).toISOString() : null,
            max_downloads: editMaxDownloads ? parseInt(editMaxDownloads) : null,
            is_active: editActive,
            password: editPassword || undefined
        });
        setEditLink(null);
        fetchLinks();
    } catch (err: any) {
    console.error('Save edit error:', err);
    alert('Failed to update share link: ' + err.message);
}
};
    const fetchLinks = async () => {
        setLoading(true);
        try {
            const data = await shareAPI.getMyLinks(!showInactive);
            setLinks(data.share_links);
        } catch {
            setLinks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLinks();
    }, [showInactive]);

    const handleDeactivate = async (id: string) => {
        if (!confirm('Deactivate this share link? Anyone with the link will no longer be able to download.')) return;
        await shareAPI.deactivate(id);
        fetchLinks();
    };

    const handleCopy = (url: string, id: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                if (navigator.vibrate) navigator.vibrate(60);
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            });
        } else {
            const el = document.createElement('textarea');
            el.value = url;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            if (navigator.vibrate) navigator.vibrate(60);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

    return (
        <div className="sharelinks-page">
            <header className="sharelinks-header">
                <button className="header-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
                <h1>🔗 Share Links</h1>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#c9b99a', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Show inactive
                </label>
            </header>

            <main className="sharelinks-main">
                {loading ? (
                    <p style={{ fontSize: '0.85rem', color: '#6b5c3e' }}>Loading...</p>
                ) : links.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#a09070', fontStyle: 'italic' }}>No share links found.</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Expires</th>
                                    <th>Downloads</th>
                                    <th>Password</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {links.map((link) => (
                                    <tr key={link.id}>
                                        <td style={{ maxWidth: '160px', wordBreak: 'break-word' }}>{link.file.name}</td>
                                        <td>{formatDate(link.expires_at)}</td>
                                        <td>{link.download_count}{link.max_downloads ? ` / ${link.max_downloads}` : ''}</td>
                                        <td>{link.has_password ? '🔒 Yes' : '—'}</td>
                                        <td>
                                            <span className={`admin-status-badge ${link.is_active ? 'active' : 'inactive'}`}>
                                                {link.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="admin-table-actions">
                                                <button
                                                    className="file-action-btn"
                                                    onClick={() => handleCopy(link.public_url, link.id)}
                                                >
                                                    {copiedId === link.id ? '✓ Copied' : 'Copy URL'}
                                                </button>
                                                <button
    className="file-action-btn"
    onClick={() => handleEdit(link)}
>
    Edit
</button>
                                                {link.is_active && (
                                                    <button
                                                        className="file-action-btn file-action-btn-danger"
                                                        onClick={() => handleDeactivate(link.id)}
                                                    >
                                                        Deactivate
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
            {editLink && (
    <div className="move-modal-backdrop" onClick={() => setEditLink(null)}>
        <div className="move-modal" onClick={(e) => e.stopPropagation()}>
            <p className="move-modal-title">Edit Share Link</p>
            <p style={{ fontSize: '0.75rem', color: '#6b5c3e', margin: 0 }}>{editLink.file.name}</p>

            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Expiry Date</label>
            <input
                className="sidebar-input"
                type="date"
                value={editExpiry}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={(e) => setEditExpiry(e.target.value)}
            />

            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Max Downloads</label>
            <input
                className="sidebar-input"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={editMaxDownloads}
                onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!e.target.value || val >= 1) setEditMaxDownloads(e.target.value);
                }}
            />
    <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>New Password (min 4 chars, leave blank to keep existing)</label>

            <input
                className="sidebar-input"
                type="password"
                placeholder="New password (optional)"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                />
                Link is active
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
                <button className="upload-btn" onClick={handleSaveEdit}>Save</button>
                <button className="file-input-btn" onClick={() => setEditLink(null)}>Cancel</button>
            </div>
        </div>
    </div>
)}
        </div>
    );
}

export default ShareLinksPage;
