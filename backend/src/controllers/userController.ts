import { Request, Response } from 'express';
import { getAllUsers, getUserById, updateUserQuota, deleteUser, restoreUser, hardDeleteUser } from '../services/userService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { runAllCleanupTasks } from '../services/cleanupService';
import { User } from '../models';


/**
 * GET /api/v1/users
 * List all users (admin only)
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const result = await getAllUsers(page, limit);

        res.json(result);
    } catch (error) {
        logger.error('List users failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/users/:id
 * Get user details (admin only)
 */
export async function getUser(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const userId = req.params.id as string;
        const user = await getUserById(userId);

        res.json({ user });
    } catch (error) {
        logger.error('Get user failed', {
            error: (error as Error).message,
            userId: req.params.id
        });
        throw error;
    }
}

/**
 * PUT /api/v1/users/:id/quota
 * Update user storage quota (admin only)
 */
export async function updateQuota(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const userId = req.params.id as string;
        const { storage_quota } = req.body;

        // Validate quota
        if (storage_quota !== null && typeof storage_quota !== 'number') {
            throw new AppError('Invalid quota value', 400);
        }

        const user = await updateUserQuota(userId, storage_quota);

        res.json({
            message: 'User quota updated successfully',
            user: {
                id: user.id,
                username: user.username,
                storage_quota: user.storage_quota,
                storage_used: user.storage_used
            }
        });
    } catch (error) {
        logger.error('Update quota failed', {
            error: (error as Error).message,
            userId: req.params.id
        });
        throw error;
    }
}

/**
 * DELETE /api/v1/users/:id
 * Delete user (admin only) - NOT IMPLEMENTED YET
 */
export async function removeUser(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const userId = req.params.id as string;
        await deleteUser(userId, req.user.userId);

        res.json({
            message: 'User deleted successfully'
        });
    } catch (error) {
        logger.error('Delete user failed', {
            error: (error as Error).message,
            userId: req.params.id
        });
        throw error;
    }
}

/**
 * POST /api/v1/users/:id/restore
 * Restore deactivated user (admin only)
 */
export async function restoreUserHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const userId = req.params.id as string;
        const user = await restoreUser(userId, req.user.userId);

        res.json({
            message: 'User restored successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                is_active: user.is_active
            }
        });
    } catch (error) {
        logger.error('Restore user failed', {
            error: (error as Error).message,
            userId: req.params.id
        });
        throw error;
    }
}

/**
 * DELETE /api/v1/users/:id/permanent
 * Permanently delete user and all data (admin only)
 */
export async function permanentDeleteUser(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const userId = req.params.id as string;
        const { confirm } = req.body;

        // Require explicit confirmation
        if (confirm !== true) {
            throw new AppError('Must confirm permanent deletion by setting confirm: true', 400);
        }

        const stats = await hardDeleteUser(userId, req.user.userId);

        res.json({
            message: 'User permanently deleted',
            stats: {
                files_deleted: stats.filesDeleted,
                folders_deleted: stats.foldersDeleted,
                storage_freed: stats.storageFreed,
                share_links_deactivated: stats.shareLinksDeactivated
            }
        });
    } catch (error) {
        logger.error('Permanent delete user failed', {
            error: (error as Error).message,
            userId: req.params.id
        });
        throw error;
    }
}


/**
 * POST /api/v1/users/cleanup
 * Manually trigger cleanup tasks (admin only)
 */
export async function triggerCleanup(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const results = await runAllCleanupTasks();

        res.json({
            message: 'Cleanup tasks completed',
            results
        });
    } catch (error) {
        logger.error('Manual cleanup failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/users/me
 * Get current user's profile
 */
export async function getMe(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const user = await User.findByPk(req.user.userId, {
            attributes: [
                'id',
                'username',
                'email',
                'role',
                'storage_used',
                'storage_quota',
                'two_fa_enabled',
                'is_active',
                'created_at',
                'updated_at'
            ]
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Calculate storage percentage
        const storagePercentage = user.storage_quota
            ? Math.round((user.storage_used / user.storage_quota) * 100)
            : 0;

        res.json({
            user: {
                ...user.toJSON(),
                storage_percentage: storagePercentage
            }
        });
    } catch (error) {
        logger.error('Get current user failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}