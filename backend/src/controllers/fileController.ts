import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { thumbnailQueue } from '../config/queue';
import fs from 'fs';
import { File, Folder } from '../models';
import { checkAndLinkDuplicate, completeChunkedUpload, deleteUserFile, permanentlyDeleteFile, restoreFile, getTrash, moveFileToFolder  } from '../services/fileService';
import { createUploadSession, getUploadSession, saveChunk } from '../services/chunkService';
import { addToStorageUsed, validateStorageQuota } from '../services/quotaService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { ActivityAction } from '../models/ActivityLog';
import ActivityLog from '../models/ActivityLog';
import { calculateBufferHash } from '../services/hashService';
import { createFileReference } from '../services/deduplicationService';
import { generateStoragePath, getFilePath, ensureFileDirectory } from '../services/storageService';

// ========================================
// CHECK DUPLICATE (Pre-Upload)
// ========================================

/**
 * POST /api/v1/files/check-duplicate
 * Check if file exists before uploading
 */
export async function checkDuplicate(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { file_hash, file_size, filename, mime_type, folder_id } = req.body;

        // Validate folder if provided
        if (folder_id) {
            const folder = await Folder.findByPk(folder_id);
            
            if (!folder) {
                throw new AppError('Folder not found', 404);
            }
            
            if (folder.user_id !== req.user.userId) {
                throw new AppError('Unauthorized - folder belongs to another user', 403);
            }
            
            if (folder.is_deleted) {
                throw new AppError('Cannot upload to deleted folder', 400);
            }
        }

        // Check and link if duplicate
        const file = await checkAndLinkDuplicate(
            req.user.userId,
            file_hash,
            filename,
            file_size,
            mime_type,
            folder_id || null
        );

        if (file) {
            // Duplicate found - instant upload!
            logger.info('Duplicate file linked instantly', {
                fileId: file.id,
                userId: req.user.userId,
                filename
            });

            res.json({
                exists: true,
                file: {
                    id: file.id,
                    original_name: file.original_name,
                    size: file.size,
                    mime_type: file.mime_type,
                    created_at: file.created_at
                },
                message: 'File already exists, linked to your account instantly'
            });
        } else {
            // Not a duplicate - proceed with upload
            res.json({
                exists: false,
                message: 'File is unique, proceed with upload'
            });
        }

    } catch (error) {
        logger.error('Duplicate check failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// INITIALIZE CHUNKED UPLOAD
// ========================================

/**
 * POST /api/v1/files/upload/init
 * Initialize chunked upload session
 */
export async function initChunkedUpload(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { filename, file_size, file_hash, mime_type, total_chunks, folder_id } = req.body;

        // Validate folder if provided
        if (folder_id) {
            const folder = await Folder.findByPk(folder_id);
            
            if (!folder) {
                throw new AppError('Folder not found', 404);
            }
            
            if (folder.user_id !== req.user.userId) {
                throw new AppError('Unauthorized - folder belongs to another user', 403);
            }
            
            if (folder.is_deleted) {
                throw new AppError('Cannot upload to deleted folder', 400);
            }
        }

        // Validate storage quota
        await validateStorageQuota(req.user.userId, file_size);

        // Generate session ID
        const sessionId = uuidv4();

        // Create upload session
        const session = await createUploadSession(
            sessionId,
            req.user.userId,
            filename,
            file_size,
            file_hash,
            mime_type,
            total_chunks,
            folder_id || null
        );

        logger.info('Chunked upload initialized', {
            sessionId,
            userId: req.user.userId,
            filename,
            totalChunks: total_chunks,
            fileSize: file_size
        });

        res.json({
            upload_session_id: sessionId,
            chunk_size: 104857600, // 100MB
            total_chunks: total_chunks,
            expires_at: session.expires_at,
            message: 'Upload session created'
        });

    } catch (error) {
        logger.error('Failed to initialize chunked upload', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// UPLOAD CHUNK
// ========================================

/**
 * POST /api/v1/files/upload/chunk
 * Upload single chunk
 */
export async function uploadChunk(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { upload_session_id, chunk_index } = req.body;
        const chunkFile = req.file;

        if (!chunkFile) {
            throw new AppError('No chunk file provided', 400);
        }

        // Save chunk
        const result = await saveChunk(
            upload_session_id,
            parseInt(chunk_index),
            chunkFile.buffer
        );

        logger.info('Chunk uploaded', {
            sessionId: upload_session_id,
            chunkIndex: chunk_index,
            progress: `${result.received}/${result.total_chunks}`
        });

        res.json({
            chunk_index: result.chunk_index,
            received: result.received,
            total_chunks: result.total_chunks,
            chunks_remaining: result.chunks_remaining,
            progress_percentage: ((result.received / result.total_chunks) * 100).toFixed(2)
        });

    } catch (error) {
        logger.error('Chunk upload failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// COMPLETE UPLOAD
// ========================================

/**
 * POST /api/v1/files/upload/complete
 * Finalize chunked upload
 */
export async function completeUpload(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { upload_session_id, file_hash } = req.body;

        // Complete upload
        const result = await completeChunkedUpload(upload_session_id, file_hash);

        // Log activity
        await ActivityLog.log(ActivityAction.UPLOAD, {
            userId: req.user.userId,
            fileId: result.file.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                filename: result.file.original_name,
                size: result.file.size,
                deduplication: result.wasDeduplication,
                storage_saved: result.storageSaved
            }
        });

        logger.info('Upload completed successfully', {
            fileId: result.file.id,
            userId: req.user.userId,
            filename: result.file.original_name,
            deduplication: result.wasDeduplication
        });

        res.json({
            message: 'Upload completed successfully',
            file: {
                id: result.file.id,
                original_name: result.file.original_name,
                size: result.file.size,
                mime_type: result.file.mime_type,
                file_hash: result.file.file_hash,
                created_at: result.file.created_at
            },
            deduplication: result.wasDeduplication,
            storage_saved: result.storageSaved
        });

    } catch (error) {
        logger.error('Upload completion failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// GET UPLOAD STATUS
// ========================================

/**
 * GET /api/v1/files/upload/status/:session_id
 * Get upload session status (for resume)
 */
export async function getUploadStatus(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const session_id = req.params.session_id as string;
        const session = await getUploadSession(session_id);

        if (!session) {
            throw new AppError('Upload session not found or expired', 404);
        }

        // Verify session belongs to user
        if (session.user_id !== req.user.userId) {
            throw new AppError('Unauthorized', 403);
        }

        res.json({
            session_id: session.session_id,
            filename: session.filename,
            total_chunks: session.total_chunks,
            chunks_received: session.chunks_received,
            chunks_missing: session.chunks_missing,
            progress_percentage: ((session.chunks_received.length / session.total_chunks) * 100).toFixed(2),
            expires_at: session.expires_at
        });

    } catch (error) {
        logger.error('Failed to get upload status', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// LIST FILES
// ========================================

/**
 * GET /api/v1/files
 * List user's files with pagination
 */
export async function listFiles(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const { rows: files, count } = await File.findAndCountAll({
            where: {
                user_id: req.user.userId,
                is_deleted: false,
                is_available: true  // Only show completed uploads
            },
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        res.json({
            files: files.map(f => ({
                id: f.id,
                original_name: f.original_name,
                size: f.size,
                mime_type: f.mime_type,
                created_at: f.created_at,
                folder_id: f.folder_id
            })),
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Failed to list files', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// DELETE FILE
// ========================================

/**
 * DELETE /api/v1/files/:id
 * Soft delete file (move to trash)
 */
export async function deleteFile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;
        await deleteUserFile(id, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.DELETE, {
            userId: req.user.userId,
            fileId: id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        res.json({
            message: 'File moved to trash'
        });

    } catch (error) {
        logger.error('Failed to delete file', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * POST /api/v1/files/:id/restore
 * Restore file from trash
 */
export async function restoreFileFromTrash(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        await restoreFile(id, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.RESTORE, {
            userId: req.user.userId,
            fileId: id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        res.json({
            message: 'File restored from trash'
        });

    } catch (error) {
        logger.error('Failed to restore file', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * DELETE /api/v1/files/:id/permanent
 * Permanently delete file (skip trash)
 */
export async function permanentDelete(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;
        
        // Get file first to verify ownership
        const file = await File.findByPk(id);
        
        if (!file) {
            throw new AppError('File not found', 404);
        }
        
        if (file.user_id !== req.user.userId) {
            throw new AppError('Unauthorized', 403);
        }

                // Log activity
        await ActivityLog.log(ActivityAction.DELETE, {
            userId: req.user.userId,
            fileId: id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                permanent: true,
                filename: file.original_name
            }
        });

        // Permanently delete
        await permanentlyDeleteFile(id);

        res.json({
            message: 'File permanently deleted'
        });

    } catch (error) {
        logger.error('Failed to permanently delete file', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/files/trash
 * Get user's trashed files
 */
export async function getTrashFiles(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const { files, total } = await getTrash(req.user.userId, page, limit);

        res.json({
            files: files.map(f => ({
                id: f.id,
                original_name: f.original_name,
                size: f.size,
                mime_type: f.mime_type,
                deleted_at: f.deleted_at,
                folder_id: f.folder_id,
                days_until_permanent_delete: Math.max(0, 30 - Math.floor((Date.now() - new Date(f.deleted_at!).getTime()) / (1000 * 60 * 60 * 24)))
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('Failed to get trash', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}



/**
 * POST /api/v1/files/upload
 * Direct upload for small files (<100MB)
 */
export async function uploadSmallFile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const uploadedFile = req.file;
        
        if (!uploadedFile) {
            throw new AppError('No file provided', 400);
        }

        const { folder_id } = req.body;

        // Validate folder if provided
        if (folder_id) {
            const folder = await Folder.findByPk(folder_id);
            
            if (!folder) {
                throw new AppError('Folder not found', 404);
            }
            
            if (folder.user_id !== req.user.userId) {
                throw new AppError('Unauthorized - folder belongs to another user', 403);
            }
            
            if (folder.is_deleted) {
                throw new AppError('Cannot upload to deleted folder', 400);
            }
        }

        // Calculate hash
        const fileHash = await calculateBufferHash(uploadedFile.buffer);

        // Check for duplicate
        const duplicate = await checkAndLinkDuplicate(
            req.user.userId,
            fileHash,
            uploadedFile.originalname,
            uploadedFile.size,
            uploadedFile.mimetype,
            folder_id || null
        );

        if (duplicate) {
            // Instant upload via deduplication
            res.json({
                message: 'File already exists, linked instantly',
                file: {
                    id: duplicate.id,
                    original_name: duplicate.original_name,
                    size: duplicate.size,
                    mime_type: duplicate.mime_type,
                    created_at: duplicate.created_at
                },
                deduplication: true
            });
            return;
        }

        // Validate quota
        await validateStorageQuota(req.user.userId, uploadedFile.size);

        // Generate storage path
        const extension = path.extname(uploadedFile.originalname);
        const storagePath = generateStoragePath(fileHash, extension);
        const filePath = getFilePath(fileHash, extension);

        // Save file to disk
        await ensureFileDirectory(filePath);
        await fs.promises.writeFile(filePath, uploadedFile.buffer);

        // Create file reference
        const fileReference =  await createFileReference(fileHash, storagePath);

        // Create file record
        const file = await File.create({
            user_id: req.user.userId,
            folder_id: folder_id || null,
            original_name: uploadedFile.originalname,
            stored_name: path.basename(filePath),
            file_path: storagePath,
            file_hash: fileHash,
            mime_type: uploadedFile.mimetype,
            size: uploadedFile.size,
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
        await addToStorageUsed(req.user.userId, uploadedFile.size);

        // Log activity
        await ActivityLog.log(ActivityAction.UPLOAD, {
            userId: req.user.userId,
            fileId: file.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                filename: file.original_name,
                size: file.size,
                upload_type: 'direct'
            }
        });

        res.status(201).json({
            message: 'File uploaded successfully',
            file: {
                id: file.id,
                original_name: file.original_name,
                size: file.size,
                mime_type: file.mime_type,
                file_hash: file.file_hash,
                created_at: file.created_at
            },
            deduplication: false
        });

    } catch (error) {
        logger.error('Direct upload failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/files/:id/download
 * Download file
 */
export async function downloadFile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        // Get file
        const file = await File.findByPk(id);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify ownership
        if (file.user_id !== req.user.userId) {
            throw new AppError('Unauthorized', 403);
        }

        // Check if deleted
        if (file.is_deleted) {
            throw new AppError('File is in trash', 404);
        }

        // Check if available
        if (!file.is_available) {
            throw new AppError('File is not available (upload may be incomplete)', 400);
        }

        // Log download activity
        await ActivityLog.log(ActivityAction.DOWNLOAD, {
            userId: req.user.userId,
            fileId: file.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                filename: file.original_name,
                size: file.size
            }
        });

        // Get file path
        const filePath = getFilePath(file.file_hash, path.extname(file.original_name));

        // Check if file exists on disk
        if (!fs.existsSync(filePath)) {
            logger.error('Physical file not found on disk', {
                fileId: file.id,
                filePath,
                hash: file.file_hash
            });
            throw new AppError('File not found on disk', 500);
        }
        const userId = req.user.userId
        const fileId = file.id;

        logger.info('File download started', {
            fileId: file.id,
            userId: req.user.userId,
            filename: file.original_name
        });

        // Send file with proper headers
        res.download(filePath, file.original_name, (err) => {
            if (err) {
                logger.error('File download failed', {
                    error: err.message,
                    fileId,
                    userId
                });
            } else {
                logger.info('File download completed', {
                    fileId: file.id,
                    userId
                });
            }
        });

    } catch (error) {
        logger.error('Download failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * PUT /api/v1/files/:id/move
 * Move file to different folder
 */
export async function moveFile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;
        const { folder_id } = req.body;

        const file = await moveFileToFolder(id, folder_id || null, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.MOVE_FILE, {
            userId: req.user.userId,
            fileId: file.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                filename: file.original_name,
                target_folder_id: folder_id || null
            }
        });

        res.json({
            message: 'File moved successfully',
            file: {
                id: file.id,
                original_name: file.original_name,
                folder_id: file.folder_id
            }
        });

    } catch (error) {
        logger.error('Failed to move file', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/files/:id/thumbnail
 * Get file thumbnail
 */
export async function getThumbnail(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        // Get file
        const file = await File.findByPk(id);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify ownership
        if (file.user_id !== req.user.userId) {
            throw new AppError('Unauthorized', 403);
        }

        // Check if thumbnail exists
        if (!file.thumbnail_path) {
            throw new AppError('Thumbnail not available for this file', 404);
        }

        // Check if thumbnail file exists on disk
        if (!fs.existsSync(file.thumbnail_path)) {
            throw new AppError('Thumbnail file not found', 404);
        }

        // Stream thumbnail
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

        const stream = fs.createReadStream(file.thumbnail_path);
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.error('Thumbnail stream error', {
                error: error.message,
                fileId: id
            });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream thumbnail' });
            }
        });

    } catch (error) {
        logger.error('Get thumbnail failed', {
            error: (error as Error).message,
            fileId: req.params.id
        });
        throw error;
    }
}