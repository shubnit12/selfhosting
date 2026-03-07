import { useState, useEffect } from 'react';
import { fileAPI, folderAPI } from '../api/client';
import { useNavigate } from "react-router-dom";
import FileThumbnail from '../components/FileThumbnail';


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

        <div>
            <button onClick={() => navigate('/dashboard')}>dashboard</button>
            <h1>Trash</h1>
            <p>Deleted files and folders (30-day retention)</p>

            <h2>Deleted Files ({trashedFiles.length})</h2>
{trashedFiles.length === 0 ? (
    <p>No deleted files</p>
) : (
    <div>
        <div>
            <input
                type="checkbox"
                checked={trashedFiles.every(f => selectedFileIds.has(f.id))}
                onChange={toggleSelectAll}
            />
            <span> Select All</span>
            {selectedFileIds.size > 0 && (
                <>
                    <button onClick={handleBulkRestore}>Restore ({selectedFileIds.size})</button>
                    <button onClick={handleBulkPermanentDelete}>Delete Forever ({selectedFileIds.size})</button>
                    <button onClick={() => setSelectedFileIds(new Set())}>Clear</button>
                </>
            )}
        </div>
        <ul>
            {trashedFiles.map((file) => (
                <li key={file.id}>
                    <input
                        type="checkbox"
                        checked={selectedFileIds.has(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                    />
                    <FileThumbnail fileId={file.id} mimeType={file.mime_type} /> {file.original_name} - {file.days_until_permanent_delete} days left
                    {' '}
                    <button onClick={() => handleRestoreFile(file.id, file.original_name)}>Restore</button>
                    {' '}
                    <button onClick={() => handlePermanentDelete(file.id, file.original_name)}>Delete Forever</button>
                </li>
            ))}
        </ul>
    </div>
)}

            <h2>Deleted Folders ({trashedFolders.length})</h2>
            {trashedFolders.length === 0 ? (
                <p>No deleted folders</p>
            ) : (
                <ul>
                    {trashedFolders.map((folder) => (
                        <li key={folder.id}>
                            📁 {folder.name} - {folder.days_until_permanent_delete} days left
                             {' '}
            <button onClick={() => handleRestoreFolder(folder.id, folder.name)}>
                Restore
            </button>
            
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default TrashPage;