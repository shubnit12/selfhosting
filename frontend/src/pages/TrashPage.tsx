import { useState, useEffect } from 'react';
import { fileAPI, folderAPI } from '../api/client';
import { useNavigate } from "react-router-dom";
import FileThumbnail from '../components/FileThumbnail';
import './TrashPage.css';
import './Dashboard.css';



function TrashPage() {
    const [trashedFiles, setTrashedFiles] = useState<any[]>([]);
    const [trashedFolders, setTrashedFolders] = useState<any[]>([]);
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

    const navigate = useNavigate()

    useEffect(() => {
        fetchTrash();
    }, []);

    const fetchTrash = async () => {
        try {
            // Fetch trashed files
            const filesData = await fileAPI.getTrash();
            setTrashedFiles(filesData.files);
            console.log('Trashed files:', filesData.files);

            // Fetch trashed folders
            const foldersData = await folderAPI.getTrash();
            setTrashedFolders(foldersData.folders);
            console.log('Trashed folders:', foldersData.folders);
        } catch (error) {
            console.error('Failed to fetch trash:', error);
        }
    };
    const handleRestoreFile = async (fileId: string, filename: string) => {
    try {
        await fileAPI.restore(fileId);
        console.log('File restored:', filename);
        
        // Refresh trash
        await fetchTrash();
    } catch (error) {
        console.error('Restore file failed:', error);
    }
};
const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
    });
};

const toggleSelectAll = () => {
    if (trashedFiles.every(f => selectedFileIds.has(f.id))) {
        setSelectedFileIds(new Set());
    } else {
        setSelectedFileIds(new Set(trashedFiles.map(f => f.id)));
    }
};
const handleBulkRestore = async () => {
    const toRestore = trashedFiles.filter(f => selectedFileIds.has(f.id));
    if (toRestore.length === 0) return;
    if (!confirm(`Restore ${toRestore.length} file(s)?`)) return;
    for (const file of toRestore) {
        await fileAPI.restore(file.id);
    }
    setSelectedFileIds(new Set());
    await fetchTrash();
};
const handleBulkPermanentDelete = async () => {
    const toDelete = trashedFiles.filter(f => selectedFileIds.has(f.id));
    if (toDelete.length === 0) return;
    if (!confirm(`Permanently delete ${toDelete.length} file(s)? This cannot be undone!`)) return;
    for (const file of toDelete) {
        await fileAPI.permanentDelete(file.id);
    }
    setSelectedFileIds(new Set());
    await fetchTrash();
};
const handleRestoreFolder = async (folderId: string, folderName: string) => {
    try {
        await folderAPI.restore(folderId);
        console.log('Folder restored:', folderName);
        
        // Refresh trash
        await fetchTrash();
    } catch (error) {
        console.error('Restore folder failed:', error);
    }
};
const handlePermanentDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Permanently delete folder "${folderName}" and all its contents? This cannot be undone!`)) return;

    try {
        await folderAPI.permanentDelete(folderId);
        console.log('Folder permanently deleted:', folderName);
        await fetchTrash();
    } catch (error) {
        console.error('Permanent delete folder failed:', error);
    }
};
const handlePermanentDelete = async (fileId: string, filename: string) => {
    if (!confirm(`Permanently delete ${filename}? This cannot be undone!`)) return;

    try {
        await fileAPI.permanentDelete(fileId);
        console.log('File permanently deleted:', filename);
        
        // Refresh trash
        await fetchTrash();
    } catch (error) {
        console.error('Permanent delete failed:', error);
    }
};
    return (
    <div className="trash-page">
        <header className="trash-header">
            <button className="header-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
            <h1>🗑 Trash</h1>
            <p>30-day retention</p>
        </header>

        <main className="trash-main">

            <div>
                <p className="trash-section-heading">Deleted Files ({trashedFiles.length})</p>
                {trashedFiles.length === 0 ? (
                    <p className="trash-empty">No deleted files</p>
                ) : (
                    <div>
                        <div className="bulk-toolbar">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                <input
                                    type="checkbox"
                                    checked={trashedFiles.every(f => selectedFileIds.has(f.id))}
                                    onChange={toggleSelectAll}
                                />
                                Select All
                            </label>
                            {selectedFileIds.size > 0 && (
                                <>
                                    <button className="bulk-btn" onClick={handleBulkRestore}>Restore ({selectedFileIds.size})</button>
                                    <button className="bulk-btn bulk-btn-danger" onClick={handleBulkPermanentDelete}>Delete Forever ({selectedFileIds.size})</button>
                                    <button className="bulk-btn" onClick={() => setSelectedFileIds(new Set())}>Clear</button>
                                </>
                            )}
                        </div>
                        <ul className="file-list">
                            {trashedFiles.map((file) => (
                                <li key={file.id} className="file-row">
                                    <input type="checkbox" checked={selectedFileIds.has(file.id)} onChange={() => toggleFileSelection(file.id)} />
                                    <div className="file-thumb-area" style={{ cursor: 'default' }}>
                                        <FileThumbnail fileId={file.id} mimeType={file.mime_type} fill />
                                    </div>
                                    <span className="file-name">{file.original_name}</span>
                                    <span className="days-badge">{file.days_until_permanent_delete}d left</span>
                                    <div className="file-row-actions">
                                        <button className="file-action-btn" onClick={() => handleRestoreFile(file.id, file.original_name)}>Restore</button>
                                        <button className="file-action-btn file-action-btn-danger" onClick={() => handlePermanentDelete(file.id, file.original_name)}>Delete Forever</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div>
                <p className="trash-section-heading">Deleted Folders ({trashedFolders.length})</p>
                {trashedFolders.length === 0 ? (
                    <p className="trash-empty">No deleted folders</p>
                ) : (
                    <ul className="file-list">
                        {trashedFolders.map((folder) => (
                            <li key={folder.id} className="file-row">
                                <div className="file-thumb-area" style={{ cursor: 'default', fontSize: '2rem' }}>📁</div>
                                <span className="file-name">{folder.name}</span>
                                <span className="days-badge">{folder.days_until_permanent_delete}d left</span>
                                <div className="file-row-actions">
                                    <button className="file-action-btn" onClick={() => handleRestoreFolder(folder.id, folder.name)}>Restore</button>
                                    <button className="file-action-btn file-action-btn-danger" onClick={() => handlePermanentDeleteFolder(folder.id, folder.name)}>Delete Forever</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

        </main>
    </div>
);
}

export default TrashPage;
