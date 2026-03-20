import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { shareAPI } from '../api/client';
import './SharePage.css';

function SharePage() {
    const { token } = useParams<{ token: string }>();
    const [info, setInfo] = useState<any>(null);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        shareAPI.getInfo(token)
            .then((data) => setInfo(data))
            .catch(() => setError('This link is invalid or has expired.'))
            .finally(() => setLoading(false));
    }, [token]);

    const handleVerifyPassword = async () => {
        try {
            await shareAPI.verifyPassword(token!, password);
            setPasswordVerified(true);
            setVerifyError('');
        } catch {
            setVerifyError('Incorrect password. Please try again.');
        }
    };

    const handleDownload = () => {
        const url = shareAPI.getDownloadUrl(token!, info.requires_password && passwordVerified ? password : undefined);
        window.open(url, '_blank');
    };

    if (loading) return <div className="share-page"><p className="share-loading">Loading...</p></div>;
    if (error) return <div className="share-page"><div className="share-card"><p className="share-error">{error}</p></div></div>;

    const canDownload = !info.requires_password || passwordVerified;

    return (
        <div className="share-page">
            <div className="share-card">
                <p className="share-app-name">Shubnit's Drive</p>
                <div className="share-file-icon">📄</div>
                <p className="share-filename">{info.file.name}</p>
                <p className="share-meta">{(info.file.size / (1024 * 1024)).toFixed(2)} MB · {info.file.mime_type}</p>

                {info.expires_at && (
                    <p className="share-meta">Expires: {new Date(info.expires_at).toLocaleDateString()}</p>
                )}
                {info.downloads_remaining !== null && (
                    <p className="share-meta">{info.downloads_remaining} download(s) remaining</p>
                )}

                {info.requires_password && !passwordVerified && (
                    <div className="share-password-form">
                        <p className="share-password-label">This file is password protected</p>
                        <input
                            className="share-input"
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                        />
                        {verifyError && <p className="share-error">{verifyError}</p>}
                        <button className="share-btn" onClick={handleVerifyPassword}>Unlock</button>
                    </div>
                )}

                {canDownload && (
                    <button className="share-btn share-btn-download" onClick={handleDownload}>
                        ⬇ Download
                    </button>
                )}
            </div>
        </div>
    );
}

export default SharePage;
