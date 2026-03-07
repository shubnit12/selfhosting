import { Router } from 'express';
import { listPublicFolders, getPublicFolder, downloadPublicFile, getPublicThumbnail } from '../../../controllers/publicFolderController';

const router = Router();

// No authentication required for these routes

/**
 * GET /api/v1/public/folders
 * List all public folders
 */
router.get('/', listPublicFolders);

/**
 * GET /api/v1/public/folders/:slug
 * Get public folder contents
 */
router.get('/:slug', getPublicFolder);

/**
 * GET /api/v1/public/folders/:slug/files/:fileId/download
 * Download file from public folder
 */
router.get('/:slug/files/:fileId/download', downloadPublicFile);

router.get('/:slug/files/:fileId/thumbnail', getPublicThumbnail);


export default router;