import './PublicFolderPage.css';
import '../Overlay.css';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicFolderAPI } from '../api/client';

function PublicFolderPage() {
    const { slug } = useParams<{ slug: string }>();
    const [folder, setFolder] = useState<any>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [overlayFile, setOverlayFile] = useState<any>(null);
    const [zoomed, setZoomed] = useState(false);

    useEffect(() => {
        if (!slug) return;
        publicFolderAPI.getBySlug(slug)
            .then((data) => {
                setFolder(data.folder);
                setFiles(data.files);
            })
            .catch((err) => {
                setError(err.response?.data?.error || 'Folder not found');
            })
            .finally(() => setLoading(false));
    }, [slug]);
    useEffect(() => {
        if (overlayFile) {
            history.pushState({ overlay: true }, '');
            const handlePopState = () => {
                setOverlayFile(null);
                setZoomed(false);
            };
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [overlayFile]);

    if (loading) return <p className="public-page-loading">Loading...</p>;
    if (error) return <p className="public-page-error">{error}</p>;

    return (
        <div className="public-page">
            <div className="public-folder-header">
                <h1>{folder?.name}</h1>
                <p>{files.length} file(s)</p>
            </div>
            {files.length === 0 ? <p className="public-empty">No files in this folder</p> : (
                <ul className="public-file-grid">
                    {files.map((file) => (
                        <div key={file.id} className="public-file-card">
                            <img
                                src={publicFolderAPI.getThumbnailUrl(slug!, file.id)}
                                onClick={() => { setOverlayFile(file); setZoomed(false); }}
                                style={{ cursor: 'pointer' }}
                                onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('div'), { className: 'public-file-card-no-thumb', textContent: '📄' })); }}
                            />
                            <span className="public-file-name">{file.original_name}</span>
                            <span className="public-file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            {' '}
                            <a
                                href={publicFolderAPI.getDownloadUrl(slug!, file.id)}
                                download={file.original_name}
                                className="public-download-btn"
                            >
                                Download
                            </a>
                        </div>
                    ))}
                </ul>
            )}


            {overlayFile && (
                <div
                    className="overlay-backdrop"
                    onClick={() => { setOverlayFile(null); setZoomed(false); }}
                >
                    <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
                        {overlayFile.mime_type?.startsWith('image/') ? (
                            <img
                                src={publicFolderAPI.getDownloadUrl(slug!, overlayFile.id)}
                                className={`overlay-img${zoomed ? ' zoomed' : ''}`}
                                onClick={() => setZoomed(prev => !prev)}
                            />
                        ) : overlayFile.mime_type?.startsWith('video/') ? (
                            <video
                                src={publicFolderAPI.getDownloadUrl(slug!, overlayFile.id)}
                                className="overlay-video"
                                controls
                                autoPlay
                                preload="metadata"
                            />
                        ) : (
                            <div className="overlay-other">
                                <p className="overlay-filename">{overlayFile.original_name}</p>
                                <a
                                    href={publicFolderAPI.getDownloadUrl(slug!, overlayFile.id)}
                                    download={overlayFile.original_name}
                                    className="public-download-btn"
                                >
                                    Download
                                </a>
                            </div>
                        )}
                        <button
                            className="overlay-close-btn"
                            onClick={() => { setOverlayFile(null); setZoomed(false); }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PublicFolderPage;
