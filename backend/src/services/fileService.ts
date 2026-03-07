import path from 'path';
import { thumbnailQueue } from '../config/queue';
import { File, FileReference, Folder } from '../models';
import { calculateFileHash, verifyFileHash } from './hashService';
import { 
    generateStoragePath, 
    getFilePath, 
    moveFile,
    deleteFile,
    ensureFileDirectory,
    getTempUploadPath 
} from './storageService';
import { 
    checkDuplicate, 
    linkToExistingFile,
    createFileReference,
    decrementReference 
} from './deduplicationService';
import { 
    validateStorageQuota, 
    addToStorageUsed,
    subtractFromStorageUsed 
} from './quotaService';
import { 
    assembleChunks,
    cleanupUploadSession,
    getUploadSession 
} from './chunkService';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ========================================
// INTERFACES
// ========================================

interface FileUploadResult {
    file: File;
    wasDeduplication: boolean;
    storageSaved: number;
}

// ========================================
// PRE-UPLOAD DUPLICATE CHECK
// ========================================

/**
 * Check if file exists before upload (pre-upload duplicate detection)
 * If exists, instantly link to existing file
 * 
 * @param userId - User ID
 * @param fileHash - SHA256 hash
 * @param filename - Original filename
 * @param fileSize - File size
 * @param mimeType - MIME type
 * @param folderId - Folder ID (optional)
 * @returns File if duplicate, null if should proceed with upload
 */
export async function checkAndLinkDuplicate(
    userId: string,
    fileHash: string,
    filename: string,
    fileSize: number,
    mimeType: string,
    folderId: string | null = null
): Promise<File | null> {
    try {
        // Check if duplicate exists
        const duplicateCheck = await checkDuplicate(fileHash);

        if (!duplicateCheck.isDuplicate) {
            logger.debug('File is unique, proceed with upload', {
                hash: fileHash.substring(0, 16) + '...'
            });
            return null;
        }

        // Duplicate found! Link to existing file
        logger.info('Duplicate detected, linking to existing file', {
            userId,
            hash: fileHash.substring(0, 16) + '...',
            filename
        });

        // Validate quota (still counts against user's quota)
        await validateStorageQuota(userId, fileSize);

        // Link to existing file
        const file = await linkToExistingFile(
            userId,
            fileHash,
            filename,
            folderId,
            mimeType,
            fileSize
        );

        // Update user's storage usage
        await addToStorageUsed(userId, fileSize);

        logger.info('File linked successfully (instant upload)', {
            fileId: file.id,
            userId,
            filename,
            savedBandwidth: `${(fileSize / 1024 / 1024).toFixed(2)}MB`
        });

        return file;

    } catch (error) {
        logger.error('Duplicate check and link failed', {
            error: (error as Error).message,
            userId,
            hash: fileHash.substring(0, 16) + '...'
        });
        throw error;
    }
}

// ========================================
// COMPLETE CHUNKED UPLOAD
// ========================================

/**
 * Complete chunked upload - assemble, verify, store
 * 
 * @param sessionId - Upload session UUID
 * @param providedHash - Hash provided by frontend
 * @returns Upload result
 */
export async function completeChunkedUpload(
    sessionId: string,
    providedHash: string
): Promise<FileUploadResult> {
    try {
        // Get session
        const session = await getUploadSession(sessionId);

        if (!session) {
            throw new AppError('Upload session not found or expired', 404);
        }

        // Verify all chunks received
        if (session.chunks_missing.length > 0) {
            throw new AppError(
                `Upload incomplete. Missing chunks: ${session.chunks_missing.join(', ')}`,
                400
            );
        }

        // Assemble chunks to temp file
        const tempFilePath = path.join(
            getTempUploadPath(sessionId),
            'assembled_file'
        );

        logger.info('Assembling chunks', {
            sessionId,
            totalChunks: session.total_chunks
        });

        const assembledSize = await assembleChunks(sessionId, tempFilePath);

        // Verify hash
        logger.info('Verifying file hash', { sessionId });
        
        const isHashValid = await verifyFileHash(tempFilePath, providedHash);

        if (!isHashValid) {
            // Hash mismatch - file corrupted
            await cleanupUploadSession(sessionId);
            await deleteFile(tempFilePath);
            
            throw new AppError('File corrupted during upload (hash mismatch)', 400);
        }

        // Check for deduplication
        const duplicateCheck = await checkDuplicate(session.file_hash);

        if (duplicateCheck.isDuplicate) {
            // Duplicate found after upload - link to existing
            logger.info('Duplicate detected after upload, linking to existing', {
                sessionId,
                hash: session.file_hash.substring(0, 16) + '...'
            });

            const file = await linkToExistingFile(
                session.user_id,
                session.file_hash,
                session.filename,
                session.folder_id,
                session.mime_type,
                session.file_size
            );

            // Update storage usage
            await addToStorageUsed(session.user_id, session.file_size);

            // Cleanup temp files
            await deleteFile(tempFilePath);
            await cleanupUploadSession(sessionId);

            return {
                file,
                wasDeduplication: true,
                storageSaved: session.file_size
            };
        }

        // New unique file - store it
        const extension = path.extname(session.filename);
        const storagePath = generateStoragePath(session.file_hash, extension);
        const finalPath = getFilePath(session.file_hash, extension);

        // Move file to final location
        await moveFile(tempFilePath, finalPath);

        // Create file reference
        const fileReference = await createFileReference(session.file_hash, storagePath);

        // Create file record
        const file = await File.create({
            user_id: session.user_id,
            folder_id: session.folder_id,
            original_name: session.filename,
            stored_name: path.basename(finalPath),
            file_path: storagePath,
            file_hash: session.file_hash,
            mime_type: session.mime_type,
            size: session.file_size,
            upload_status: 'completed',
            is_available: true
        });

        await thumbnailQueue.add('generate-thumbnail', {
            fileId: file.id,
            filePath: getFilePath(fileReference.file_hash, path.extname(fileReference.stored_path)),
            fileHash: fileReference.file_hash,
            mimeType: file.mime_type
        });

        // Update storage usage
        await addToStorageUsed(session.user_id, session.file_size);

        // Cleanup temp files and session
        await cleanupUploadSession(sessionId);

        logger.info('File upload completed successfully', {
            fileId: file.id,
            userId: session.user_id,
            filename: session.filename,
            size: session.file_size
        });

        return {
            file,
            wasDeduplication: false,
            storageSaved: 0
        };

    } catch (error) {
        logger.error('Failed to complete chunked upload', {
            error: (error as Error).message,
            sessionId
        });
        throw error;
    }
}

// ========================================
// DELETE FILE
// ========================================

/**
 * Delete file (soft delete to trash)
 * 
 * @param fileId - File ID
 * @param userId - User ID (for authorization)
 */
export async function deleteUserFile(
    fileId: string,
    userId: string
): Promise<void> {
    try {
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify ownership
        if (file.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        // Soft delete
        await file.update({
            is_deleted: true,
            deleted_at: new Date()
        });

        // Subtract from storage usage
        await subtractFromStorageUsed(userId, file.size);

        logger.info('File soft deleted', {
            fileId,
            userId,
            filename: file.original_name
        });

    } catch (error) {
        logger.error('Failed to delete file', {
            error: (error as Error).message,
            fileId,
            userId
        });
        throw error;
    }
}

/**
 * Permanently delete file (after 30 days in trash)
 * Handles reference counting and physical file deletion
 * 
 * @param fileId - File ID
 */
export async function permanentlyDeleteFile(fileId: string): Promise<void> {
    try {
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Decrement reference count
        const shouldDeletePhysical = await decrementReference(file.file_hash);

        if (shouldDeletePhysical) {
            // No more references - delete physical file
            const physicalPath = getFilePath(file.file_hash, path.extname(file.original_name));
            await deleteFile(physicalPath);
            
            logger.info('Physical file deleted', {
                hash: file.file_hash.substring(0, 16) + '...',
                path: physicalPath
            });
        } else {
            logger.info('Physical file kept (other users still reference it)', {
                hash: file.file_hash.substring(0, 16) + '...'
            });
        }

        // Delete file record
        await file.destroy();

        logger.info('File permanently deleted', {
            fileId,
            filename: file.original_name
        });

    } catch (error) {
        logger.error('Failed to permanently delete file', {
            error: (error as Error).message,
            fileId
        });
        throw error;
    }
}


/**
 * Restore file from trash
 * 
 * @param fileId - File ID
 * @param userId - User ID (for authorization)
 */
export async function restoreFile(
    fileId: string,
    userId: string
): Promise<void> {
    try {
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify ownership
        if (file.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        if (!file.is_deleted) {
            throw new AppError('File is not in trash', 400);
        }

        // Restore file
        await file.update({
            is_deleted: false,
            deleted_at: null
        });

        // Add back to storage usage
        await addToStorageUsed(userId, file.size);

        // Cascade-restore parent folder chain if any folder in the chain is deleted
        if (file.folder_id) {
            const restoredFolderIds: string[] = [];
            let currentFolderId: string | null = file.folder_id;

            while (currentFolderId) {
                const folder: Folder | null = await Folder.findByPk(currentFolderId);

                if (!folder || folder.user_id !== userId) break;

                if (folder.is_deleted) {
                    await folder.update({
                        is_deleted: false,
                        deleted_at: null
                    });
                    restoredFolderIds.push(folder.id);
                    logger.info('Parent folder cascade-restored', {
                        folderId: folder.id,
                        folderName: folder.name,
                        restoredForFileId: fileId
                    });
                }

                // Walk up to parent
                currentFolderId = folder.parent_folder_id;
            }

            if (restoredFolderIds.length > 0) {
                logger.info('Cascade restored parent folders for file', {
                    fileId,
                    filename: file.original_name,
                    restoredFolderIds
                });
            }
        }

        logger.info('File restored from trash', {
            fileId,
            userId,
            filename: file.original_name
        });

    } catch (error) {
        logger.error('Failed to restore file', {
            error: (error as Error).message,
            fileId,
            userId
        });
        throw error;
    }
}


/**
 * Get user's trashed files
 * 
 * @param userId - User ID
 * @param page - Page number
 * @param limit - Items per page
 * @returns Trashed files with pagination
 */
export async function getTrash(
    userId: string,
    page: number = 1,
    limit: number = 50
): Promise<{ files: File[], total: number }> {
    try {
        const offset = (page - 1) * limit;

        const { rows: files, count } = await File.findAndCountAll({
            where: {
                user_id: userId,
                is_deleted: true
            },
            limit,
            offset,
            order: [['deleted_at', 'DESC']]  // Most recently deleted first
        });

        logger.debug('Trash retrieved', {
            userId,
            count,
            page
        });

        return { files, total: count };

    } catch (error) {
        logger.error('Failed to get trash', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Move file to different folder
 * 
 * @param fileId - File ID
 * @param targetFolderId - Target folder ID (null = root)
 * @param userId - User ID (for authorization)
 */
export async function moveFileToFolder(
    fileId: string,
    targetFolderId: string | null,
    userId: string
): Promise<File> {
    try {
        // Get file
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify ownership
        if (file.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        // Check if deleted
        if (file.is_deleted) {
            throw new AppError('Cannot move deleted file', 400);
        }

        // Validate target folder if provided
        if (targetFolderId) {
            const targetFolder = await Folder.findByPk(targetFolderId);

            if (!targetFolder) {
                throw new AppError('Target folder not found', 404);
            }

            if (targetFolder.user_id !== userId) {
                throw new AppError('Unauthorized - target folder belongs to another user', 403);
            }

            if (targetFolder.is_deleted) {
                throw new AppError('Cannot move to deleted folder', 400);
            }
        }

        // Update file's folder
        await file.update({
            folder_id: targetFolderId
        });

        logger.info('File moved to folder', {
            fileId,
            userId,
            oldFolderId: file.folder_id,
            newFolderId: targetFolderId
        });

        return file;

    } catch (error) {
        logger.error('Failed to move file', {
            error: (error as Error).message,
            fileId,
            userId
        });
        throw error;
    }
}