import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { adminOnly } from '../../../middleware/adminOnly';
import { listUsers, getUser, updateQuota, removeUser, restoreUserHandler, permanentDeleteUser, getMe } from '../../../controllers/userController';
import { triggerCleanup } from '../../../controllers/userController';

const router = Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.get('/me', getMe);
router.use(adminOnly);

/**
 * GET /api/v1/users
 * List all users with pagination
 */
router.get('/', listUsers);

/**
 * PUT /api/v1/users/:id/quota
 * Update user storage quota
 */
router.put('/:id/quota', updateQuota);

/**
 * POST /api/v1/users/:id/restore
 * Restore deactivated user
 */
router.post('/:id/restore', restoreUserHandler);

/**
 * DELETE /api/v1/users/:id/permanent
 * Permanently delete user and all data
 */
router.delete('/:id/permanent', permanentDeleteUser);

/**
 * GET /api/v1/users/:id
 * Get specific user details
 */
router.get('/:id', getUser);



/**
 * DELETE /api/v1/users/:id
 * Delete user (not implemented yet)
 */
router.delete('/:id', removeUser);

/**
 * POST /api/v1/users/cleanup
 * Manually trigger cleanup tasks
 */
router.post('/cleanup', triggerCleanup);


export default router;