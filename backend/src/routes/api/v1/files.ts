import { Router } from 'express';
import {
    checkDuplicate,
    initChunkedUpload,
    uploadChunk,
    completeUpload,
    getUploadStatus,
    listFiles,
    deleteFile,
    permanentDelete,
    restoreFileFromTrash,
    getTrashFiles,
    uploadSmallFile
} from '../../../controllers/fileController';
import { authenticateToken } from '../../../middleware/auth';
import { uploadChunk as uploadChunkMiddleware, uploadSingleFile } from '../../../middleware/upload';
import { downloadRateLimiter, uploadRateLimiter } from '../../../middleware/rateLimiter';
import { validate } from '../../../middleware/validators';
import {
    checkDuplicateSchema,
    initChunkedUploadSchema,
    uploadChunkSchema,
    completeUploadSchema
} from '../../../middleware/validators';
import { downloadFile } from '../../../controllers/fileController'; 
import { moveFile } from '../../../controllers/fileController';  
import { moveFileSchema } from '../../../middleware/validators'; 
import { getThumbnail } from '../../../controllers/fileController';

const router = Router();

// All file routes require authentication
router.use(authenticateToken);

// ========================================
// FILE UPLOAD ENDPOINTS
// ========================================

/**
 * POST /api/v1/files/check-duplicate
 * Check if file exists before uploading
 */
router.post(
    '/check-duplicate',
    validate(checkDuplicateSchema),
    checkDuplicate
);


/**
 * POST /api/v1/files/upload
 * Direct upload for small files
 */
router.post(
    '/upload',
    uploadRateLimiter,
    uploadSingleFile,  // Multer middleware
    uploadSmallFile
);

/**
 * POST /api/v1/files/upload/init
 * Initialize chunked upload
 */
router.post(
    '/upload/init',
    uploadRateLimiter,
    validate(initChunkedUploadSchema),
    initChunkedUpload
);

/**
 * POST /api/v1/files/upload/chunk
 * Upload single chunk
 */
router.post(
    '/upload/chunk',
    uploadRateLimiter,
    uploadChunkMiddleware,  // Multer handles file upload
    validate(uploadChunkSchema),
    uploadChunk
);

/**
 * POST /api/v1/files/upload/complete
 * Complete chunked upload
 */
router.post(
    '/upload/complete',
    validate(completeUploadSchema),
    completeUpload
);

/**
 * GET /api/v1/files/upload/status/:session_id
 * Get upload session status
 */
router.get(
    '/upload/status/:session_id',
    getUploadStatus
);

// ========================================
// FILE MANAGEMENT ENDPOINTS
// ========================================

/**
 * GET /api/v1/files
 * List user's files
 */
router.get(
    '/',
    listFiles
);


/**
 * PUT /api/v1/files/:id/move
 * Move file to different folder
 */
router.put(
    '/:id/move',
    validate(moveFileSchema),
    moveFile
);

/**
 * GET /api/v1/files/:id/download
 * Download file
 */
router.get(
    '/:id/download',
    downloadRateLimiter,  // Use download rate limiter
    downloadFile
);

/**
 * DELETE /api/v1/files/:id
 * Delete file (soft delete)
 */
router.delete(
    '/:id',
    deleteFile
);

/**
 * POST /api/v1/files/:id/restore
 * Restore file from trash
 */
router.post(
    '/:id/restore',
    restoreFileFromTrash
);

/**
 * DELETE /api/v1/files/:id/permanent
 * Permanently delete file
 */
router.delete(
    '/:id/permanent',
    permanentDelete
);

/**
 * GET /api/v1/files/trash
 * Get trashed files
 */
router.get(
    '/trash',
    getTrashFiles
);


/**
 * GET /api/v1/files/:id/thumbnail
 * Get file thumbnail
 */
router.get('/:id/thumbnail', getThumbnail);
export default router;