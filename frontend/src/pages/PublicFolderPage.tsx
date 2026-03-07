import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicFolderAPI } from '../api/client';

function PublicFolderPage() {
    const { slug } = useParams<{ slug: string }>();
    const [folder, setFolder] = useState<any>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    if (loading) return <p>Loading...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

    return (
        <div>
            <h1>📁 {folder?.name}</h1>
            <p>{files.length} file(s)</p>

            {files.length === 0 ? <p>No files in this folder</p> : (
                <ul>
                    {files.map((file) => (
                        <li key={file.id} style={{ marginBottom: '12px' }}>
                            <img
                                src={publicFolderAPI.getThumbnailUrl(slug!, file.id)}
                                width={60}
                                height={60}
                                style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '8px' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            {file.original_name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            {' '}
                            <a href={publicFolderAPI.getDownloadUrl(slug!, file.id)} download={file.original_name}>
                                Download
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PublicFolderPage;