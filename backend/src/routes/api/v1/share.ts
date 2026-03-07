import { Router } from 'express';
import {
    createShare,
    getShareInfo,
    verifyPassword,
    downloadSharedFile,
    getMyShareLinks,
    updateShare,
    deleteShare
} from '../../../controllers/shareController';
import { authenticateToken } from '../../../middleware/auth';
import { validate } from '../../../middleware/validators';
import {
    createShareLinkSchema,
    updateShareLinkSchema,
    verifyPasswordSchema
} from '../../../middleware/validators';

const router = Router();


// ========================================
// AUTHENTICATED ENDPOINTS
// ========================================

/**
 * POST /api/v1/share
 * Create share link
 */
router.post(
    '/',
    authenticateToken,
    validate(createShareLinkSchema),
    createShare
);

/**
 * GET /api/v1/share/my-links
 * Get user's share links
 */
router.get(
    '/my-links',
    authenticateToken,
    getMyShareLinks
);

/**
 * PUT /api/v1/share/:id
 * Update share link
 */
router.put(
    '/:id',
    authenticateToken,
    validate(updateShareLinkSchema),
    updateShare
);

/**
 * DELETE /api/v1/share/:id
 * Deactivate share link
 */
router.delete(
    '/:id',
    authenticateToken,
    deleteShare
);

// ========================================
// PUBLIC ENDPOINTS (No authentication)
// ========================================

/**
 * GET /api/v1/share/:token
 * Get file info (public)
 */
router.get(
    '/:token',
    getShareInfo
);

/**
 * POST /api/v1/share/:token/verify-password
 * Verify password (public)
 */
router.post(
    '/:token/verify-password',
    validate(verifyPasswordSchema),
    verifyPassword
);

/**
 * GET /api/v1/share/:token/download
 * Download file (public)
 */
router.get(
    '/:token/download',
    downloadSharedFile
);

export default router;
