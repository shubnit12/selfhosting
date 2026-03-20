import './Dashboard.css';
import '../Overlay.css';
import { useNavigate } from "react-router-dom";
import { folderAPI, fileAPI,shareAPI } from "../api/client";
import { useState, useEffect, useRef } from "react";
import FileThumbnail from '../components/FileThumbnail';

import { calculateFileHash, splitFileIntoChunks } from '../utils/fileHash';

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function Dashboard() {

    const navigate = useNavigate()
    const [folderTree, setFolderTree] = useState([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
    const [pendingUploads, setPendingUploads] = useState<any[]>([]);
    const [rootFiles, setRootFiles] = useState<any[]>([]);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

    const [overlayBlobUrl, setOverlayBlobUrl] = useState<string | null>(null);
    const [breadcrumbPath, setBreadcrumbPath] = useState<{ id: string, name: string }[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [overlayFile, setOverlayFile] = useState<any>(null);
    const [zoomed, setZoomed] = useState(false);


    const [moveModalFiles, setMoveModalFiles] = useState<any[]>([]);
const [moveModalOpen, setMoveModalOpen] = useState(false);
const [shareModalFile, setShareModalFile] = useState<any>(null);
const [shareLink, setShareLink] = useState<any>(null);
const [sharePassword, setSharePassword] = useState('');
const [shareExpiry, setShareExpiry] = useState('');
const [shareMaxDownloads, setShareMaxDownloads] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addMoreInputRef = useRef<HTMLInputElement>(null);

const [copiedToast, setCopiedToast] = useState(false);

    const buildBreadcrumb = (folders: any[], targetId: string, path: { id: string, name: string }[] = []): { id: string, name: string }[] | null => {
        for (const folder of folders) {
            const currentPath = [...path, { id: folder.id, name: folder.name }];
            if (folder.id === targetId) return currentPath;
            if (folder.subfolders?.length > 0) {
                const found = buildBreadcrumb(folder.subfolders, targetId, currentPath);
                if (found) return found;
            }
        }
        return null;
    };
const flattenFolderTree = (folders: any[], depth = 0): { id: string, name: string, depth: number }[] => {
    const result: { id: string, name: string, depth: number }[] = [];
    for (const folder of folders) {
        result.push({ id: folder.id, name: folder.name, depth });
        if (folder.subfolders?.length > 0) {
            result.push(...flattenFolderTree(folder.subfolders, depth + 1));
        }
    }
    return result;
};
    const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setStagedFiles(prev => {
        const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
        const filtered = newFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
        return [...prev, ...filtered];
    });
    e.target.value = '';
};

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

    useEffect(() => {
        fetchFolderTree();
        // Check for incomplete uploads
        const pending = checkPendingUploads();
        setPendingUploads(pending);
        if (selectedFolderId === null) {
            // Fetch root files
            fetchRootFiles();
        }
    }, [selectedFolderId])
    useEffect(() => {
        if (!overlayFile) {
            if (overlayBlobUrl) {
                URL.revokeObjectURL(overlayBlobUrl);
                setOverlayBlobUrl(null);
            }
            return;
        }
        fileAPI.download(overlayFile.id).then((blob: Blob) => {
            const url = URL.createObjectURL(blob);
            setOverlayBlobUrl(url);
        });
    }, [overlayFile]);

    const fetchRootFiles = async () => {
        try {
            const filesData = await fileAPI.getFiles(1, 100);
            const rootFilesOnly = filesData.files.filter((f: any) => f.folder_id === null);
            setRootFiles(rootFilesOnly);  // ← Store in state
            console.log('Root files:', rootFilesOnly);
            // Create virtual folder object for root
            // const virtualRootFolder = {
            //     id: null,
            //     name: 'Root',
            //     files: rootFilesOnly
            // };

            // You'll need to store this temporarily
        } catch (error) {
            console.error('Failed to fetch root files:', error);
        }
    };
    const fetchFolderTree = async () => {
        try {
            const data = await folderAPI.getTree();
            setFolderTree(data.tree)
            console.log('Folder tree:', data.tree);

            // Also fetch root files (folder_id = null)
            // const filesData = await fileAPI.getFiles(1, 100);  // We need to add this API
            // const rootFilesOnly = filesData.files.filter((f: any) => f.folder_id === null);
            // setRootFiles(rootFilesOnly);
            // console.log('Root files:', rootFilesOnly);
        } catch (error) {
            console.error('Failed to fetch folder tree:', error);
        }
    }
    const handleLogout = () => {

        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user');
        navigate('/login')
    }
    const handleFolderClick = (folderId: string) => {
        setSelectedFolderId(folderId)
        setSelectedFileIds(new Set());
        const path = buildBreadcrumb(folderTree, folderId);
        setBreadcrumbPath(path || []);
        console.log('Selected folder:', folderId);
    }

    const findFolderInTree = (tree: any[], folderId: string): any => {
        for (const folder of tree) {
            if (folder.id === folderId) {
                return folder
            }
            if (folder.subfolders.length > 0) {
                const found = findFolderInTree(folder.subfolders, folderId);
                if (found) return found
            }
        }
        return null;
    }

    const selectedFolder = selectedFolderId
        ? findFolderInTree(folderTree, selectedFolderId)
        : null;

    const filesToDisplay = selectedFolder ? selectedFolder.files : rootFiles
    const updateUploadItem = (id: string, updates: Partial<UploadItem>) => {
        setUploadQueue(prev =>
            prev.map(item => item.id === id ? { ...item, ...updates } : item)
        );
    };

    const handleFileDownload = async (fileId: string, filename: string) => {
        try {
            const blob = await fileAPI.download(fileId);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click()
            window.URL.revokeObjectURL(url);
            console.log('Downloaded:', filename);
        } catch (error) {
            console.error('Download failed:', error);
        }
    }

    const uploadSingleFile = async (item: UploadItem) => {
        updateUploadItem(item.id, { status: 'uploading', progress: 0 });

        try {
            const file = item.file;

            // Calculate hash
            // const fileHash = await calculateFileHash(file);
            // Calculate hash with progress
            updateUploadItem(item.id, { status: 'uploading', progress: 0 });
            const fileHash = await calculateFileHash(file, (hashPercent) => {
                // Show hashing progress as 0-50% of the overall progress bar
                // We reserve 50-100% for actual upload
                updateUploadItem(item.id, { progress: Math.round(hashPercent / 2) });
            });

            // Handle empty MIME type (files without extensions)
            const mimeType = file.type || 'application/octet-stream';

            // Check duplicate
            const duplicateCheck = await fileAPI.checkDuplicate(
                fileHash, file.size, file.name, mimeType, selectedFolderId
            );

            if (duplicateCheck.exists) {
                updateUploadItem(item.id, { status: 'done', progress: 100 });
                await fetchFolderTree();
                return;
            }

            if (file.size <= 100 * 1024 * 1024) {
                // Direct upload
                await fileAPI.upload(file, selectedFolderId);
                updateUploadItem(item.id, { status: 'done', progress: 100 });
            } else {
                // Chunked upload
                const chunks = splitFileIntoChunks(file);
                const initResponse = await fileAPI.uploadInit(
                    file.name, file.size, fileHash, mimeType, chunks.length, selectedFolderId
                );
                const sessionId = initResponse.upload_session_id;
                console.log("sessionId: ", sessionId);

                // Save session to localStorage for resume on interruption
                const uploadSession = {
                    sessionId,
                    filename: file.name,
                    fileSize: file.size,
                    fileHash,
                    totalChunks: chunks.length,
                    folderId: selectedFolderId
                };
                localStorage.setItem(`upload_${sessionId}`, JSON.stringify(uploadSession));

                for (let i = 0; i < chunks.length; i++) {
                    await fileAPI.uploadChunk(sessionId, i, chunks[i]);
                    // const progress = Math.round(((i + 1) / chunks.length) * 100);
                    const progress = 50 + Math.round(((i + 1) / chunks.length) * 50);
                    updateUploadItem(item.id, { progress });
                }

                await fileAPI.uploadComplete(sessionId, fileHash);
                // Remove session from localStorage on success
                updateUploadItem(item.id, { status: 'done', progress: 100 });
                localStorage.removeItem(`upload_${sessionId}`);
            }

            await fetchFolderTree();

        } catch (error: any) {
            console.error('Upload failed:', item.filename, error);
            updateUploadItem(item.id, { status: 'error', error: 'Upload failed' });
        }
    };

    // const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    //     const files = Array.from(e.target.files || []);
    //     if (files.length === 0) return;

    //     // Build queue items for all selected files
    //     const newItems: UploadItem[] = files.map(file => ({
    //         id: crypto.randomUUID(),
    //         file,
    //         filename: file.name,
    //         progress: 0,
    //         status: 'pending'
    //     }));

    //     // Add all items to queue at once (so UI shows all of them)
    //     setUploadQueue(newItems);

    //     // Process one by one sequentially
    //     for (const item of newItems) {
    //         await uploadSingleFile(item);
    //     }

    //     // Refresh files after all done
    //     if (selectedFolderId === null) {
    //         await fetchRootFiles();
    //     }
    // };

    const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setStagedFiles(files);
    };
    const handleStartUpload = async () => {
        if (stagedFiles.length === 0) return;

        // Build queue items for all staged files
        const newItems: UploadItem[] = stagedFiles.map(file => ({
            id: generateId(),
            file,
            filename: file.name,
            progress: 0,
            status: 'pending',
            previewUrl: URL.createObjectURL(file)
        }));

        // Clear staged files
        setStagedFiles([]);

        // Add all to queue at once so UI shows all progress bars
        setUploadQueue(newItems);

        // Process one by one sequentially
        for (const item of newItems) {
            await uploadSingleFile(item);
        }

        // Refresh root files if in root
        if (selectedFolderId === null) {
            await fetchRootFiles();
        }
    };
    const handlerCreateFolder = async () => {
        if (!newFolderName.trim()) {
            alert('Please enter folder name');
            return;
        }

        try {
            await folderAPI.create(newFolderName, selectedFolderId);
            console.log('Foolder cereated: ', newFolderName)
            setNewFolderName('');
            await fetchFolderTree();
        } catch (error) {
            console.error('Create folder failed:', error);

        }
    }
    const handleFileDelete = async (fileId: string, filename: string) => {
        if (!confirm(`Delete ${filename}?`)) return
        try {
            await fileAPI.delete(fileId);
            console.log('File Deleted: ', filename)
            // Refresh folder tree
            await fetchFolderTree();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    }
    // const handleFileMove = async (fileId: string, filename: string) => {
    //     // Simple approach: prompt for folder ID
    //     const targetFolderId = prompt(`Move "${filename}" to folder ID (or leave empty for root):`);

    //     // User cancelled
    //     if (targetFolderId === null) return;

    //     try {
    //         await fileAPI.move(fileId, targetFolderId || null);
    //         console.log('File moved:', filename);

    //         // Refresh folder tree
    //         await fetchFolderTree();
    //     } catch (error) {
    //         console.error('Move file failed:', error);
    //         alert('Move failed. Folder may not exist or you may not have permission.');
    //     }
    // };

    const handleFileMove = (fileId: string, filename: string) => {
    setMoveModalFiles([{ id: fileId, original_name: filename }]);
    setMoveModalOpen(true);

};
    const checkPendingUploads = () => {
        const pendingSessions: any[] = [];

        // Check localStorage for upload sessions
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('upload_')) {
                const sessionData = localStorage.getItem(key);
                if (sessionData) {
                    pendingSessions.push(JSON.parse(sessionData));
                }
            }
        }

        return pendingSessions;
    };
    const resumeUpload = async (sessionData: any, file: File) => {
        const resumeItem: UploadItem = {
            id: generateId(),
            file,
            filename: file.name,
            progress: 0,
            status: 'uploading'
        };
        setUploadQueue([resumeItem]);

        try {
            const status = await fileAPI.uploadStatus(sessionData.sessionId);
            console.log('Resume upload - status:', status);
            const missingChunks = status.chunks_missing;
            console.log('Missing chunks:', missingChunks);

            if (missingChunks.length === 0) {
                // All chunks uploaded, just complete
                await fileAPI.uploadComplete(sessionData.sessionId, sessionData.fileHash);
                localStorage.removeItem(`upload_${sessionData.sessionId}`);
                updateUploadItem(resumeItem.id, { status: 'done', progress: 100 });
                setPendingUploads(prev => prev.filter((s: any) => s.sessionId !== sessionData.sessionId));
                await fetchFolderTree();
                return;
            }
            // Split file into chunks again
            const chunks = splitFileIntoChunks(file);
            // Upload only missing chunks
            for (const chunkIndex of missingChunks) {
                console.log(`Resuming chunk ${chunkIndex + 1}/${sessionData.totalChunks}`);
                await fileAPI.uploadChunk(sessionData.sessionId, chunkIndex, chunks[chunkIndex]);

                // Update progress
                const uploaded = sessionData.totalChunks - missingChunks.length + (missingChunks.indexOf(chunkIndex) + 1);
                const progress = Math.round((uploaded / sessionData.totalChunks) * 100);
                updateUploadItem(resumeItem.id, { progress });
            }
            // Complete upload
            await fileAPI.uploadComplete(sessionData.sessionId, sessionData.fileHash);
            localStorage.removeItem(`upload_${sessionData.sessionId}`);
            updateUploadItem(resumeItem.id, { status: 'done', progress: 100 });
            setPendingUploads(prev => prev.filter((s: any) => s.sessionId !== sessionData.sessionId));
            await fetchFolderTree();

            console.log('Resume upload complete!');
        } catch (error) {
            console.error('Resume upload failed:', error);
            updateUploadItem(resumeItem.id, { status: 'error', error: 'Resume failed' });
        }
    }
    const handleFolderDelete = async (folderId: string, folderName: string) => {
        if (!confirm(`Delete folder "${folderName}"? All subfolders and files will be moved to trash.`)) return;

        try {
            await folderAPI.delete(folderId);
            console.log('Folder deleted:', folderName);

            // Clear selection if deleted folder was selected
            if (selectedFolderId === folderId) {
                setSelectedFolderId(null);
            }

            // Refresh folder tree
            await fetchFolderTree();
        } catch (error) {
            console.error('Delete folder failed:', error);
        }
    };
    const handleFolderRename = async (folderId: string, currentName: string) => {
        const newName = prompt(`Rename folder "${currentName}" to:`, currentName);

        if (!newName || newName === currentName) return;

        try {
            await folderAPI.rename(folderId, newName);
            console.log('Folder renamed:', currentName, '→', newName);

            // Refresh folder tree
            await fetchFolderTree();
        } catch (error) {
            console.error('Rename folder failed:', error);
            alert('Rename failed. Folder name may contain invalid characters.');
        }
    };

    const handleMakePublic = async (folderId: string, folderName: string) => {
        const slug = prompt(`Enter a public slug for "${folderName}" (lowercase, letters, numbers, hyphens only):`, folderName.toLowerCase().replace(/\s+/g, '-'));
        if (!slug) return;
        try {
            const result = await folderAPI.makePublic(folderId, slug);
            alert(`Folder is now public!\nURL: ${window.location.origin}/p/${result.folder.public_slug}`);
            await fetchFolderTree();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to make folder public');
        }
    };

    const handleMakePrivate = async (folderId: string) => {
        if (!confirm('Remove public access from this folder?')) return;
        try {
            await folderAPI.makePrivate(folderId);
            alert('Folder is now private.');
            await fetchFolderTree();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to make folder private');
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
    const toggleSelectAll = (files: any[]) => {
        if (files.every(f => selectedFileIds.has(f.id))) {
            setSelectedFileIds(new Set());
        } else {
            setSelectedFileIds(new Set(files.map((f: any) => f.id)));
        }
    };
    const handleBulkDelete = async (files: any[]) => {
        const toDelete = files.filter(f => selectedFileIds.has(f.id));
        if (toDelete.length === 0) return;
        if (!confirm(`Delete ${toDelete.length} file(s)?`)) return;
        for (const file of toDelete) {
            await fileAPI.delete(file.id);
        }
        setSelectedFileIds(new Set());
        await fetchFolderTree();
        if (selectedFolderId === null) await fetchRootFiles();
    };
    // const handleBulkMove = async (files: any[]) => {
    //     const toMove = files.filter(f => selectedFileIds.has(f.id));
    //     if (toMove.length === 0) return;
    //     const targetFolderId = prompt(`Move ${toMove.length} file(s) to folder ID (leave empty for root):`);
    //     if (targetFolderId === null) return;
    //     for (const file of toMove) {
    //         await fileAPI.move(file.id, targetFolderId || null);
    //     }
    //     setSelectedFileIds(new Set());
    //     await fetchFolderTree();
    //     if (selectedFolderId === null) await fetchRootFiles();
    // };
const handleBulkMove = (files: any[]) => {
    const toMove = files.filter(f => selectedFileIds.has(f.id));
    if (toMove.length === 0) return;
    setMoveModalFiles(toMove);
    setMoveModalOpen(true);
};
const handleMoveConfirm = async (targetFolderId: string | null) => {
    for (const file of moveModalFiles) {
        await fileAPI.move(file.id, targetFolderId);
    }
    setMoveModalOpen(false);
    setMoveModalFiles([]);
    setSelectedFileIds(new Set());
    await fetchFolderTree();
    if (selectedFolderId === null) await fetchRootFiles();
};
const handleShareFile = (file: any) => {
    setShareModalFile(file);
    setShareLink(null);
    setSharePassword('');
    setShareExpiry(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setShareMaxDownloads('2');
};

const handleCreateShareLink = async () => {
    if (!shareModalFile) return;
    try {
        const result = await shareAPI.create(shareModalFile.id, {
            password: sharePassword || undefined,
            expires_at: shareExpiry || undefined,
            max_downloads: shareMaxDownloads ? parseInt(shareMaxDownloads) : undefined,
            allow_preview: true
        });
        setShareLink(result.share_link);
    } catch (error) {
        alert('Failed to create share link.');
    }
};
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');


    return (
        <div className="dashboard-wrapper">
            {/* <h1>Shubnit's Drive</h1> */}
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0px', fontSize: '26px', marginBottom: '0px', marginTop: '0px' }}>
                <img src="/chiyo.svg" alt="logo" style={{ height: '80px', width: 'auto' }} />
                Shubnit's Drive
            </h1>
            <header className="dashboard-header">



                {pendingUploads.length > 0 && (
                    <div>
                        <p>{pendingUploads.length} incomplete upload(s)</p>


                        {pendingUploads.map((session) => (
                            <div key={session.sessionId}>
                                <p>{session.filename} - {session.totalChunks} chunks</p>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && file.name === session.filename) {
                                            resumeUpload(session, file);
                                        } else {
                                            alert('Please select the same file: ' + session.filename);
                                        }
                                    }}
                                />
                                <button onClick={() => {
                                    localStorage.removeItem(`upload_${session.sessionId}`);
                                    setPendingUploads(prev => prev.filter((s: any) => s.sessionId !== session.sessionId));
                                }}>Clear</button>
                            </div>
                        ))}


                    </div>
                )}

                <div className="header-nav">
                    <button className="header-btn" onClick={() => navigate('/share-links')}>Shared Links</button>
                    <button className="header-btn" onClick={() => navigate('/trash')}>Trash</button>
                    <button className="header-btn" onClick={() => navigate('/settings')}>Settings</button>
                    {currentUser.role === 'admin' && (
                        <button className="header-btn" onClick={() => navigate('/admin')}>Admin</button>
                    )}
                    <button className="header-btn header-btn-danger" onClick={handleLogout}>Logout</button>
                </div>
                <button className="hamburger-btn" onClick={() => setSidebarOpen(prev => !prev)}>☰</button>
            </header>

            <div className="dashboard-body">

                {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

                {/* Sidebar */}
                <aside className={`dashboard-sidebar${sidebarOpen ? ' open' : ''}`}>
                    <h2 className="sidebar-heading">Folders</h2>

                    <div
                        className={`sidebar-root${selectedFolderId === null ? ' active' : ''}`}
                        onClick={() => { setSelectedFolderId(null); setSelectedFileIds(new Set()); setBreadcrumbPath([]); setSidebarOpen(false); }}
                    >
                        📁 Root
                    </div>
                    {/* {folderTree.length === 0 ? (<p>No Folders or files</p>) :
                        (
                            <ul>
                                {
                                    folderTree.map((folder: any) => {
                                        return <FolderItem key={folder.id} folder={folder} onFolderClick={handleFolderClick} onFolderDelete={handleFolderDelete} onFolderRename={handleFolderRename} />
                                    })
                                }
                            </ul>
                        )} */}

                    {folderTree.length > 0 && (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {folderTree.map((folder: any) => (
                                <FolderItem
                                    key={folder.id}
                                    folder={folder}
                                    onFolderClick={handleFolderClick}
                                    onFolderDelete={handleFolderDelete}
                                    onFolderRename={handleFolderRename}
                                    onMakePublic={handleMakePublic}
                                    onMakePrivate={handleMakePrivate}
                                    role={currentUser.role}
                                />
                            ))}
                        </ul>
                    )}
                </aside>

                {/* Main content */}
                <main className="dashboard-main">
                    {/* <h2>Files</h2> */}
                    <div className="breadcrumb">
                        <span className="breadcrumb-item" onClick={() => { setSelectedFolderId(null); setBreadcrumbPath([]); }}>Root</span>
                        {breadcrumbPath.map((crumb, i) => (
                            <>
                                <span className="breadcrumb-sep" key={crumb.id + '-sep'}>/</span>
                                {i === breadcrumbPath.length - 1
                                    ? <span className="breadcrumb-current" key={crumb.id}>{crumb.name}</span>
                                    : <span className="breadcrumb-item" key={crumb.id} onClick={() => handleFolderClick(crumb.id)}>{crumb.name}</span>
                                }
                            </>
                        ))}
                    </div>

                    {
                        selectedFolder ? (
                            <div className="upload-area">
                                {/* <p>Folder: {selectedFolder.name}</p>
                                 */}
                                <div className="folder-actions-bar">
                                    <span className="folder-actions-title">📁 {selectedFolder.name}</span>
                                    <div className="folder-item-actions">
                                        <button className="folder-action-btn" onClick={() => handleFolderRename(selectedFolder.id, selectedFolder.name)}>Rename</button>
                                        {currentUser.role === 'admin' && <>
                                            {selectedFolder.is_public
                                                ? <>
                                                    <span style={{ fontSize: '11px', color: '#4a7c59' }}>🌐 {selectedFolder.public_slug}</span>
                                                    <button className="folder-action-btn" onClick={() => handleMakePrivate(selectedFolder.id)}>Make Private</button>
                                                </>
                                                : <button className="folder-action-btn" onClick={() => handleMakePublic(selectedFolder.id, selectedFolder.name)}>Make Public</button>
                                            }
                                        </>}
                                        <button className="folder-action-btn folder-action-btn-danger" onClick={() => handleFolderDelete(selectedFolder.id, selectedFolder.name)}>Delete</button>
                                    </div>
                                </div>

                                <input
                                    className="sidebar-input"
                                    type="text"
                                    placeholder="New Folder Name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                />
                                <button className="upload-btn" onClick={handlerCreateFolder}>Crete Folder</button><br></br><br></br>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleMultiFileUpload}
                                    style={{ display: 'none' }}
                                />
                                <button className="file-input-btn" onClick={() => fileInputRef.current?.click()}>
                                    📂 Choose Files
                                </button>
                                <input
    ref={addMoreInputRef}
    type="file"
    multiple
    onChange={handleAddMoreFiles}
    style={{ display: 'none' }}
/>
                                {/* Staged files preview + Upload button */}
                                {stagedFiles.length > 0 && (
                                    <div>
                                        <p>{stagedFiles.length} file(s) selected:</p>
                                        <ul>
                                            {stagedFiles.map((file, index) => (
                                                <li key={index} className="staged-file-item"> {file.type.startsWith('image/')
                                                    ? <img src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                    : file.type.startsWith('video/')
                                                        ? <video src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                        : <span style={{ marginRight: '6px' }}>📄</span>
                                                } 
                                                <span className="staged-file-name">{file.name} <span className="staged-file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span></span>
    <button className="staged-file-remove" onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== index))}>✕</button>
    </li>
                                            ))}
                                        </ul>
                                        <button className="upload-btn" onClick={handleStartUpload}>Upload {stagedFiles.length} file(s)</button>
                                        <button className="file-input-btn" onClick={() => addMoreInputRef.current?.click()}>+ Add More</button>
                                        <button className="upload-btn" onClick={() => setStagedFiles([])}>Cancel</button>

                                    </div>
                                )}
                                <p>Files: {filesToDisplay.length}</p>
                                {/* {isUploading && (
                                    <div>
                                        <p>Uploading... {uploadProgress}%</p>
                                        <div style={{
                                            width: '100%',
                                            height: '20px',
                                            backgroundColor: '#e0e0e0',
                                            borderRadius: '4px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${uploadProgress}%`,
                                                height: '100%',
                                                backgroundColor: '#4CAF50',
                                                transition: 'width 0.3s'
                                            }} />
                                        </div>
                                    </div>
                                )} */}
                                {uploadQueue.length > 0 && (
                                    <div className="upload-progress-area">
                                        <p>Uploading files: {uploadQueue.filter(i => i.status === 'done').length}/{uploadQueue.length} done</p>
                                        {uploadQueue.map(item => (
                                            <div key={item.id} className="upload-progress-row">
                                                <p style={{ margin: '0' }}>
                                                    {/* {item.previewUrl && item.file.type.startsWith('image/')
                                                        ? <img src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                        : item.previewUrl && item.file.type.startsWith('video/')
                                                            ? <video src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                            : <span style={{ marginRight: '6px' }}>📄</span>
                                                    } {item.filename} — {item.status === 'error' ? `❌ ${item.error}` : item.status === 'done' ? '✅ done' : `${item.progress}%`} */}
                                                    {item.filename} — {item.status === 'error' ? `❌ ${item.error}` : item.status === 'done' ? '✅ done' : `${item.progress}%`}

                                                </p>
                                                <div className="upload-progress-bar-track">
                                                    <div className="upload-progress-bar-fill" style={{
                                                        width: `${item.progress}%`,

                                                        backgroundColor: item.status === 'error' ? '#c0392b' : item.status === 'done' ? '#4a7c59' : '#2d2d2d'

                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {filesToDisplay.length === 0 ? (
                                    <p>No files in this folder</p>
                                ) : (
                                    <div>
                                        <div className="bulk-toolbar">
                                            <input
                                                type="checkbox"
                                                checked={filesToDisplay.every((f: any) => selectedFileIds.has(f.id))}
                                                onChange={() => toggleSelectAll(filesToDisplay)}
                                            />
                                            <span>Select All</span>
                                            {selectedFileIds.size > 0 && (
                                                <>
                                                    <button className="bulk-btn bulk-btn-danger" onClick={() => handleBulkDelete(filesToDisplay)}>Delete ({selectedFileIds.size})</button>
                                                    <button className="bulk-btn" onClick={() => handleBulkMove(filesToDisplay)}>Move ({selectedFileIds.size})</button>
                                                    <button className="bulk-btn" onClick={() => setSelectedFileIds(new Set())}>Clear</button>
                                                </>
                                            )}
                                        </div>
                                        <ul className="file-list">
                                            {filesToDisplay.map((file: any) => (
                                                <li key={file.id} className="file-row">
                                                    <input  type="checkbox" checked={selectedFileIds.has(file.id)} onChange={() => toggleFileSelection(file.id)} />
                                                    <div className="file-thumb-area" onClick={() => { setOverlayFile(file); setZoomed(false); }}>
                                                        <FileThumbnail fileId={file.id} mimeType={file.mime_type} fill />
                                                    </div>
                                                    <span className="file-name" onClick={() => handleFileDownload(file.id, file.original_name)}>
                                                        {file.original_name}
                                                    </span>
                                                    <span className="file-size">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                                                    <div className="file-row-actions">
                                                        <button className="file-action-btn" onClick={() => handleFileMove(file.id, file.original_name)}>Move</button>
                                                        <button className="file-action-btn" onClick={() => handleShareFile(file)}>Share</button>

                                                        <button className="file-action-btn file-action-btn-danger" onClick={() => handleFileDelete(file.id, file.original_name)}>Delete</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                        ) : (
                            <div className="upload-area">
                                {/* <p>Folder: Root</p>  ← Show "Root" when null */}

                                {/* Upload and create folder UI */}
                                <input
                                    className="sidebar-input"
                                    type="text"
                                    placeholder="New Folder Name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                />
                                <button className="upload-btn" onClick={handlerCreateFolder}>Create Folder</button>
                                <br /><br />
                                <input
                                ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleMultiFileUpload}
                                    style={{ display: 'none' }}
                                />
                                <button className="file-input-btn" onClick={() => fileInputRef.current?.click()}>
    📂 Choose Files
</button>
<input
    ref={addMoreInputRef}
    type="file"
    multiple
    onChange={handleAddMoreFiles}
    style={{ display: 'none' }}
/>
                                {/* Staged files preview + Upload button */}
                                {stagedFiles.length > 0 && (
                                    <div>
                                        <p>{stagedFiles.length} file(s) selected:</p>
                                        <ul className='selectdItemsUl' >
                                            {stagedFiles.map((file, index) => (
                                                <li className='selectdItemsLi' key={index}>{file.type.startsWith('image/')
                                                    ? <img src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                    : file.type.startsWith('video/')
                                                        ? <video src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                        : <span style={{ marginRight: '6px' }}>📄</span>
                                                }
                                                 <span className="staged-file-name">{file.name} <span className="staged-file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span></span>
    <button className="staged-file-remove" onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== index))}>✕</button></li>
                                            ))}
                                        </ul>
                                        <button className="upload-btn" onClick={handleStartUpload}>Upload {stagedFiles.length} file(s)</button>
                                        <button className="file-input-btn" onClick={() => addMoreInputRef.current?.click()}>+ Add More</button>
                                        <button className="upload-btn" onClick={() => setStagedFiles([])}>Cancel</button>
                                    </div>
                                )}
                                <p>Files: {rootFiles.length}</p>
                                {uploadQueue.length > 0 && (
                                    <div className="upload-progress-area">
                                        <p>Uploading files: {uploadQueue.filter(i => i.status === 'done').length}/{uploadQueue.length} done</p>
                                        {uploadQueue.map(item => (
                                            <div key={item.id} className="upload-progress-row">
                                                <p style={{ margin: '0' }}>
                                                    {item.previewUrl && item.file.type.startsWith('image/')
                                                        ? <img src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                        : item.previewUrl && item.file.type.startsWith('video/')
                                                            ? <video src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                            : <span style={{ marginRight: '6px' }}>📄</span>
                                                    } {item.filename} — {item.status === 'error' ? `❌ ${item.error}` : item.status === 'done' ? '✅ done' : `${item.progress}%`}
                                                </p>
                                                <div className="upload-progress-bar-track" style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div className="upload-progress-bar-fill" style={{
                                                        width: `${item.progress}%`,
                                                        height: '100%',
                                                        backgroundColor: item.status === 'error' ? '#f44336' : item.status === 'done' ? '#4CAF50' : '#2196F3',
                                                        transition: 'width 0.2s'
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* File list */}
                                {rootFiles.length === 0 ? (
                                    <p>No files in Root folder</p>
                                ) : (
                                    <div>
                                        <div className="bulk-toolbar">
                                            <input
                                                type="checkbox"
                                                checked={filesToDisplay.every((f: any) => selectedFileIds.has(f.id))}
                                                onChange={() => toggleSelectAll(filesToDisplay)}
                                            />
                                            <span>Select All</span>
                                            {selectedFileIds.size > 0 && (
                                                <>
                                                    <button className="bulk-btn bulk-btn-danger" onClick={() => handleBulkDelete(filesToDisplay)}>Delete ({selectedFileIds.size})</button>
                                                    <button className="bulk-btn" onClick={() => handleBulkMove(filesToDisplay)}>Move ({selectedFileIds.size})</button>
                                                    <button className="bulk-btn" onClick={() => setSelectedFileIds(new Set())}>Clear</button>
                                                </>
                                            )}
                                        </div>
                                        <ul className="file-list">
                                            {filesToDisplay.map((file: any) => (
                                                <li key={file.id} className="file-row">
                                                    <input  type="checkbox" checked={selectedFileIds.has(file.id)} onChange={() => toggleFileSelection(file.id)} />
                                                    <div className="file-thumb-area" onClick={() => { setOverlayFile(file); setZoomed(false); }}>
                                                        <FileThumbnail fileId={file.id} mimeType={file.mime_type} fill />
                                                    </div>
                                                    <span className="file-name" onClick={() => handleFileDownload(file.id, file.original_name)}>
                                                        {file.original_name}
                                                    </span>
                                                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                                                    <div className="file-row-actions">
                                                        <button className="file-action-btn" onClick={() => handleFileMove(file.id, file.original_name)}>Move</button>
                                                        <button className="file-action-btn" onClick={() => handleShareFile(file)}>Share</button>

                                                        <button className="file-action-btn file-action-btn-danger" onClick={() => handleFileDelete(file.id, file.original_name)}>Delete</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* Root files - always show at bottom */}
                    {/* <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
        <h3>Root Folder Files ({rootFiles.length})</h3>
        {rootFiles.length === 0 ? (
            <p>No files in root folder</p>
        ) : (
            <ul>
                {rootFiles.map((file: any) => (
                    <li key={file.id} style={{ marginBottom: '5px' }}>
                        <span
                            onClick={() => handleFileDownload(file.id, file.original_name)}
                            style={{ cursor: 'pointer' }}
                        >
                            📄 {file.original_name} ({file.size} bytes)
                        </span>
                        {' '}
                        <button onClick={() => handleFileMove(file.id, file.original_name)}>
                            Move
                        </button>
                        {' '}
                        <button onClick={() => handleFileDelete(file.id, file.original_name)}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        )}
    </div> */}
                </main>
            </div>
            {overlayFile && (
                <div
                    className="overlay-backdrop"
                    onClick={() => { setOverlayFile(null); setZoomed(false); }}
                >
                    <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
                        {overlayFile.mime_type?.startsWith('image/') ? (
                            <img
                                src={overlayBlobUrl || ''}
                                className={`overlay-img${zoomed ? ' zoomed' : ''}`}
                                onClick={() => setZoomed(prev => !prev)}
                            />
                        ) : overlayFile.mime_type?.startsWith('video/') ? (
                            <video
                                src={overlayBlobUrl || ''}
                                className="overlay-video"
                                controls
                                autoPlay
                            />
                        ) : (
                            <div className="overlay-other">
                                <p className="overlay-filename">{overlayFile.original_name}</p>
                                <button
                                    className="upload-btn"
                                    onClick={() => handleFileDownload(overlayFile.id, overlayFile.original_name)}
                                >
                                    Download
                                </button>
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
            {moveModalOpen && (
    <div className="move-modal-backdrop" onClick={() => setMoveModalOpen(false)}>
        <div className="move-modal" onClick={(e) => e.stopPropagation()}>
            <p className="move-modal-title">
                Move {moveModalFiles.length === 1 ? `"${moveModalFiles[0].original_name}"` : `${moveModalFiles.length} files`} to...
            </p>
            <ul className="move-modal-list">
                <li className="move-modal-item" onClick={() => handleMoveConfirm(null)}>
                    🏠 Root (no folder)
                </li>
                {flattenFolderTree(folderTree).map((folder) => (
                    <li
                        key={folder.id}
                        className="move-modal-item"
                        style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
                        onClick={() => handleMoveConfirm(folder.id)}
                    >
                        📁 {folder.name}
                    </li>
                ))}
            </ul>
            <button className="file-input-btn" onClick={() => setMoveModalOpen(false)}>Cancel</button>
        </div>
    </div>
)}
{shareModalFile && (
    <div className="move-modal-backdrop" onClick={() => setShareModalFile(null)}>
        <div className="move-modal" onClick={(e) => e.stopPropagation()}>
            <p className="move-modal-title">Share "{shareModalFile.original_name}"</p>

            {!shareLink ? (
                <>
                    <input
                        className="sidebar-input"
                        type="password"
                        placeholder="Password (optional)"
                        value={sharePassword}
                        onChange={(e) => setSharePassword(e.target.value)}
                    />
                    <input
                        className="sidebar-input"
                        type="date"
                        placeholder="Expiry date (optional)"
                        value={shareExpiry}
                        min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                        onChange={(e) => setShareExpiry(e.target.value)}
                    />
                    <input
                        className="sidebar-input"
                        type="number"
                        placeholder="Max downloads (optional)"
                        value={shareMaxDownloads}
                         min="1"
                          onChange={(e) => {
        const val = parseInt(e.target.value);
        if (!e.target.value || val >= 1) setShareMaxDownloads(e.target.value);
    }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="upload-btn" onClick={handleCreateShareLink}>Create Link</button>
                        <button className="file-input-btn" onClick={() => setShareModalFile(null)}>Cancel</button>
                    </div>
                </>
            ) : (
                <>
                    <p style={{ fontSize: '0.75rem', color: '#4a7c59', fontWeight: 700 }}>Link created!</p>
                    {copiedToast && (
    <p style={{ fontSize: '0.75rem', color: '#fff', background: '#2d2d2d', padding: '4px 10px', borderRadius: '2px', margin: 0, fontWeight: 700 }}>
        ✓ Copied!
    </p>
)}
                    <input
                        className="sidebar-input"
                        type="text"
                        readOnly
                        value={shareLink.public_url}
                        onFocus={(e) => e.target.select()}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
<button className="upload-btn" onClick={() => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareLink.public_url).then(() => { if (navigator.vibrate) navigator.vibrate(60);
setCopiedToast(true); setTimeout(() => setCopiedToast(false), 2000);});
    } else {
        const el = document.createElement('textarea');
        el.value = shareLink.public_url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        if (navigator.vibrate) navigator.vibrate(60);

        setCopiedToast(true); setTimeout(() => setCopiedToast(false), 2000);;
    }
}}>Copy URL</button>                        <button className="file-input-btn" onClick={() => setShareModalFile(null)}>Close</button>
                    </div>
                </>
            )}
        </div>
    </div>
)}
        </div>

    )
}

interface FolderItemProps {
    folder: any;
    onFolderClick: (id: string) => void;
    onFolderDelete: (id: string, name: string) => void;
    onFolderRename: (id: string, name: string) => void;
    onMakePublic: (id: string, name: string) => void;
    onMakePrivate: (id: string) => void;
    role: string;

}

interface UploadItem {
    id: string;
    file: File;
    filename: string;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
    previewUrl?: string;
}

function FolderItem({ folder, onFolderClick, onFolderDelete, onFolderRename, onMakePublic, onMakePrivate, role }: FolderItemProps) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <li style={{ listStyle: 'none' }}>
            <div className="folder-item-row">
                <span
                    className="folder-item-name"
                    onClick={() => onFolderClick(folder.id)}
                >
                    📁 {folder.name}
                    <span style={{ fontSize: '0.7rem', color: '#a09070', marginLeft: '4px' }}>({folder.file_count})</span>
                </span>
                {folder.subfolders.length > 0 && (
                    <span className="folder-toggle" onClick={() => setCollapsed(prev => !prev)}>
                        {collapsed ? '▶' : '▼'}
                    </span>
                )}
            </div>
            {!collapsed && folder.subfolders.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, marginLeft: '12px' }}>
                    {folder.subfolders.map((subfolder: any) => (
                        <FolderItem
                            key={subfolder.id}
                            folder={subfolder}
                            onFolderClick={onFolderClick}
                            onFolderDelete={onFolderDelete}
                            onFolderRename={onFolderRename}
                            onMakePublic={onMakePublic}
                            onMakePrivate={onMakePrivate}
                            role={role}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}


export default Dashboard;
