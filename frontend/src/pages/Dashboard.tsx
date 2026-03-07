import { useNavigate } from "react-router-dom";
import { folderAPI, fileAPI } from "../api/client";
import { useState, useEffect } from "react";
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


    const fetchRootFiles = async () => {
        try {
            const filesData = await fileAPI.getFiles(1, 100);
            const rootFilesOnly = filesData.files.filter((f: any) => f.folder_id === null);
            setRootFiles(rootFilesOnly);  // ← Store in state
            console.log('Root files:', rootFilesOnly);
            // Create virtual folder object for root
            const virtualRootFolder = {
                id: null,
                name: 'Root',
                files: rootFilesOnly
            };

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
    const handleFileMove = async (fileId: string, filename: string) => {
        // Simple approach: prompt for folder ID
        const targetFolderId = prompt(`Move "${filename}" to folder ID (or leave empty for root):`);

        // User cancelled
        if (targetFolderId === null) return;

        try {
            await fileAPI.move(fileId, targetFolderId || null);
            console.log('File moved:', filename);

            // Refresh folder tree
            await fetchFolderTree();
        } catch (error) {
            console.error('Move file failed:', error);
            alert('Move failed. Folder may not exist or you may not have permission.');
        }
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
    const handleBulkMove = async (files: any[]) => {
        const toMove = files.filter(f => selectedFileIds.has(f.id));
        if (toMove.length === 0) return;
        const targetFolderId = prompt(`Move ${toMove.length} file(s) to folder ID (leave empty for root):`);
        if (targetFolderId === null) return;
        for (const file of toMove) {
            await fileAPI.move(file.id, targetFolderId || null);
        }
        setSelectedFileIds(new Set());
        await fetchFolderTree();
        if (selectedFolderId === null) await fetchRootFiles();
    };


    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');


    return (
        <div>
            <header>
                <h1>File Server</h1>

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
                <button onClick={() => navigate('/trash')}>Trash</button>
                <button onClick={() => navigate('/settings')}>Settings</button>
                {currentUser.role === 'admin' && (
                    <button onClick={() => navigate('/admin')}>Admin Panel</button>
                )}
                <button onClick={handleLogout}>Logout</button>
            </header>
            <div>
                {/* Sidebar */}
                <aside>
                    <h2>Folders</h2>

                    <div
                        onClick={() => { setSelectedFolderId(null); setSelectedFileIds(new Set()); }}
                        style={{ cursor: 'pointer', fontWeight: selectedFolderId === null ? 'bold' : 'normal' }}
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
                        <ul style={{ marginLeft: '20px' }}>
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
                <main>
                    <h2>Files</h2>

                    {
                        selectedFolder ? (
                            <div>
                                <p>Folder: {selectedFolder.name}</p>

                                <input
                                    type="text"
                                    placeholder="New Folder Name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                />
                                <button onClick={handlerCreateFolder}>Crete Folder</button><br></br><br></br>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleMultiFileUpload}
                                    style={{ marginBottom: '10px' }}
                                />
                                {/* Staged files preview + Upload button */}
                                {stagedFiles.length > 0 && (
                                    <div>
                                        <p>{stagedFiles.length} file(s) selected:</p>
                                        <ul>
                                            {stagedFiles.map((file, index) => (
                                                <li key={index}> {file.type.startsWith('image/')
                                                    ? <img src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                    : file.type.startsWith('video/')
                                                        ? <video src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                        : <span style={{ marginRight: '6px' }}>📄</span>
                                                } {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                                            ))}
                                        </ul>
                                        <button onClick={handleStartUpload}>Upload {stagedFiles.length} file(s)</button>
                                        <button onClick={() => setStagedFiles([])}>Cancel</button>
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
                                    <div>
                                        <p>Uploading files: {uploadQueue.filter(i => i.status === 'done').length}/{uploadQueue.length} done</p>
                                        {uploadQueue.map(item => (
                                            <div key={item.id} style={{ marginBottom: '8px' }}>
                                                <p style={{ margin: '0' }}>
                                                    {item.previewUrl && item.file.type.startsWith('image/')
                                                        ? <img src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                        : item.previewUrl && item.file.type.startsWith('video/')
                                                            ? <video src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                            : <span style={{ marginRight: '6px' }}>📄</span>
                                                    } {item.filename} — {item.status === 'error' ? `❌ ${item.error}` : item.status === 'done' ? '✅ done' : `${item.progress}%`}
                                                </p>
                                                <div style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
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
                                {filesToDisplay.length === 0 ? (
                                    <p>No files in this folder</p>
                                ) : (
                                    <div>
                                        <div>
                                            <input
                                                type="checkbox"
                                                checked={filesToDisplay.every((f: any) => selectedFileIds.has(f.id))}
                                                onChange={() => toggleSelectAll(filesToDisplay)}
                                            />
                                            <span> Select All</span>
                                            {selectedFileIds.size > 0 && (
                                                <>
                                                    <button onClick={() => handleBulkDelete(filesToDisplay)}>Delete ({selectedFileIds.size})</button>
                                                    <button onClick={() => handleBulkMove(filesToDisplay)}>Move ({selectedFileIds.size})</button>
                                                    <button onClick={() => setSelectedFileIds(new Set())}>Clear</button>
                                                </>
                                            )}
                                        </div>
                                        <ul>
                                            {filesToDisplay.map((file: any) => (
                                                <li key={file.id} style={{ marginBottom: '5px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFileIds.has(file.id)}
                                                        onChange={() => toggleFileSelection(file.id)}
                                                    />
                                                    <span
                                                        onClick={() => handleFileDownload(file.id, file.original_name)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <FileThumbnail fileId={file.id} mimeType={file.mime_type} />
                                                        {file.original_name} ({file.size} bytes)
                                                    </span>
                                                    {' '}
                                                    <button onClick={() => handleFileMove(file.id, file.original_name)}>Move</button>
                                                    {' '}
                                                    <button onClick={() => handleFileDelete(file.id, file.original_name)}>Delete</button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                        ) : (
                            <div>
                                <p>Folder: Root</p>  {/* ← Show "Root" when null */}

                                {/* Upload and create folder UI */}
                                <input
                                    type="text"
                                    placeholder="New Folder Name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                />
                                <button onClick={handlerCreateFolder}>Create Folder</button>
                                <br /><br />
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleMultiFileUpload}
                                    style={{ marginBottom: '10px' }}
                                />
                                {/* Staged files preview + Upload button */}
                                {stagedFiles.length > 0 && (
                                    <div>
                                        <p>{stagedFiles.length} file(s) selected:</p>
                                        <ul>
                                            {stagedFiles.map((file, index) => (
                                                <li key={index}>{file.type.startsWith('image/')
                                                    ? <img src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                    : file.type.startsWith('video/')
                                                        ? <video src={URL.createObjectURL(file)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                        : <span style={{ marginRight: '6px' }}>📄</span>
                                                } {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                                            ))}
                                        </ul>
                                        <button onClick={handleStartUpload}>Upload {stagedFiles.length} file(s)</button>
                                        <button onClick={() => setStagedFiles([])}>Cancel</button>
                                    </div>
                                )}
                                <p>Files: {rootFiles.length}</p>
                                {uploadQueue.length > 0 && (
                                    <div>
                                        <p>Uploading files: {uploadQueue.filter(i => i.status === 'done').length}/{uploadQueue.length} done</p>
                                        {uploadQueue.map(item => (
                                            <div key={item.id} style={{ marginBottom: '8px' }}>
                                                <p style={{ margin: '0' }}>
                                                    {item.previewUrl && item.file.type.startsWith('image/')
                                                        ? <img src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />
                                                        : item.previewUrl && item.file.type.startsWith('video/')
                                                            ? <video src={item.previewUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} muted />
                                                            : <span style={{ marginRight: '6px' }}>📄</span>
                                                    } {item.filename} — {item.status === 'error' ? `❌ ${item.error}` : item.status === 'done' ? '✅ done' : `${item.progress}%`}
                                                </p>
                                                <div style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
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
                                        <div>
                                            <input
                                                type="checkbox"
                                                checked={rootFiles.every((f: any) => selectedFileIds.has(f.id))}
                                                onChange={() => toggleSelectAll(rootFiles)}
                                            />
                                            <span> Select All</span>
                                            {selectedFileIds.size > 0 && (
                                                <>
                                                    <button onClick={() => handleBulkDelete(rootFiles)}>Delete ({selectedFileIds.size})</button>
                                                    <button onClick={() => handleBulkMove(rootFiles)}>Move ({selectedFileIds.size})</button>
                                                    <button onClick={() => setSelectedFileIds(new Set())}>Clear</button>
                                                </>
                                            )}
                                        </div>
                                        <ul>
                                            {rootFiles.map((file: any) => (
                                                <li key={file.id} style={{ marginBottom: '5px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFileIds.has(file.id)}
                                                        onChange={() => toggleFileSelection(file.id)}
                                                    />
                                                    <span
                                                        onClick={() => handleFileDownload(file.id, file.original_name)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <FileThumbnail fileId={file.id} mimeType={file.mime_type} />
                                                        {file.original_name} ({file.size} bytes)
                                                    </span>
                                                    {' '}
                                                    <button onClick={() => handleFileMove(file.id, file.original_name)}>Move</button>
                                                    {' '}
                                                    <button onClick={() => handleFileDelete(file.id, file.original_name)}>Delete</button>
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
    return (
        <li>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                    onClick={() => onFolderClick(folder.id)}
                    style={{ cursor: 'pointer', flex: 1 }}
                >
                    📁 {folder.name} ({folder.file_count} files)
                </span>
                <button onClick={() => onFolderRename(folder.id, folder.name)}>
                    Rename
                </button>
                {' '}

                {role === 'admin' && <>{folder.is_public
                    ? <>
                        <span style={{ fontSize: '12px', color: 'green' }}>🌐 public/{folder.public_slug}</span>
                        {' '}
                        <button onClick={() => onMakePrivate(folder.id)}>Make Private</button>
                    </>
                    : <button onClick={() => onMakePublic(folder.id, folder.name)}>Make Public</button>
                }</>}

                {' '}
                <button onClick={() => onFolderDelete(folder.id, folder.name)}>
                    Delete
                </button>
            </div>
            {folder.subfolders.length > 0 && (
                <ul style={{ marginLeft: '20px' }}>
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
    )
}


export default Dashboard;