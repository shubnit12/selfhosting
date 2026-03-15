import { Router } from 'express';
import {
    createFolderHandler,
    listFolders,
    getFolder,
    renameFolderHandler,
    deleteFolderHandler,
    restoreFolderHandler,
    getTrashedFoldersHandler,
    getFolderTreeHandler,
    makePublic,
    makePrivate,
    permanentDeleteFolderHandler
} from '../../../controllers/folderController';

import { authenticateToken } from '../../../middleware/auth';
import { validate } from '../../../middleware/validators';
import {
    createFolderSchema,
    renameFolderSchema
} from '../../../middleware/validators';

const router = Router();

// All folder routes require authentication
router.use(authenticateToken);

// ========================================
// FOLDER ENDPOINTS
// ========================================

/**
 * POST /api/v1/folders
 * Create folder
 */
router.post(
    '/',
    validate(createFolderSchema),
    createFolderHandler
);

/**
 * GET /api/v1/folders
 * List folders (optionally filtered by parent)
 */
router.get(
    '/',
    listFolders
);

/**
 * GET /api/v1/folders/trash
 * Get trashed folders
 */
router.get(
    '/trash',
    getTrashedFoldersHandler
);

/**
 * GET /api/v1/folders/tree
 * Get complete folder tree with files
 */
router.get(
    '/tree',
    getFolderTreeHandler
);

/**
 * GET /api/v1/folders/:id
 * Get folder by ID
 */
router.get(
    '/:id',
    getFolder
);

/**
 * PUT /api/v1/folders/:id
 * Rename folder
 */
router.put(
    '/:id',
    validate(renameFolderSchema),
    renameFolderHandler
);

/**
 * DELETE /api/v1/folders/:id
 * Delete folder (soft delete)
 */
router.delete(
    '/:id',
    deleteFolderHandler
);

/**
 * POST /api/v1/folders/:id/restore
 * Restore folder from trash
 */
router.post(
    '/:id/restore',
    restoreFolderHandler
);

/**
 * DELETE /api/v1/folders/:id/permanent
 * Permanently delete folder (must be in trash)
 */
router.delete(
    '/:id/permanent',
    permanentDeleteFolderHandler
);


/**
 * PUT /api/v1/folders/:id/public
 * Make folder public with custom slug
 */
router.put('/:id/public', makePublic);

/**
 * DELETE /api/v1/folders/:id/public
 * Make folder private
 */
router.delete('/:id/public', makePrivate);

export default router;
