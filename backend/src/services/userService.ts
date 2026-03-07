import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { User, File, Folder, FileReference, SharedLink, ActivityLog } from '../models';
import { getFilePath } from './storageService';
import { deleteFile } from './storageService';
import { Op } from 'sequelize';
import path from 'path';

/**
 * Get all users with storage stats
 */
export async function getAllUsers(page: number = 1, limit: number = 50) {
    try {
        const offset = (page - 1) * limit;

        const { count, rows: users } = await User.findAndCountAll({
            attributes: [
                'id',
                'username',
                'email',
                'role',
                'storage_used',
                'storage_quota',
                'two_fa_enabled',
                'created_at',
                'updated_at',
                'is_active'
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        logger.debug('Users retrieved', {
            count,
            page,
            totalPages
        });

        return {
            users,
            pagination: {
                total: count,
                page,
                limit,
                totalPages
            }
        };
    } catch (error) {
        logger.error('Failed to get users', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Get single user by ID with detailed stats
 */
export async function getUserById(userId: string) {
    try {
        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'username',
                'email',
                'role',
                'storage_used',
                'storage_quota',
                'two_fa_enabled',
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

        return {
            ...user.toJSON(),
            storage_percentage: storagePercentage
        };
    } catch (error) {
        logger.error('Failed to get user', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Update user's storage quota (admin only)
 */
export async function updateUserQuota(
    userId: string,
    newQuota: number | null
) {
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Validate quota
        if (newQuota !== null && newQuota < 0) {
            throw new AppError('Quota cannot be negative', 400);
        }

        if (newQuota !== null && newQuota < user.storage_used) {
            throw new AppError(
                `Quota cannot be less than current usage (${user.storage_used} bytes)`,
                400
            );
        }

        await user.update({ storage_quota: newQuota });

        logger.info('User quota updated', {
            userId,
            oldQuota: user.storage_quota,
            newQuota
        });

        return user;
    } catch (error) {
        logger.error('Failed to update user quota', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Delete user (admin only)
 * This is a soft delete - just marks user as inactive
 */
export async function deleteUser(userId: string, adminId: string) {
    try {
        // Prevent admin from deleting themselves
        if (userId === adminId) {
            throw new AppError('Cannot delete your own account', 400);
        }

        const user = await User.findByPk(userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Prevent deleting other admins
        if (user.role === 'admin') {
            throw new AppError('Cannot delete admin users', 403);
        }

         if (!user.is_active) {
            throw new AppError('User is already deactivated', 400);
        }

        // Soft delete - mark as inactive
        await user.update({
            is_active: false,
            deleted_at: new Date()
        });
 
        // Soft delete - you can add an 'is_active' field to User model later
        // For now, we'll just log it
        logger.info('User soft deleted (deactivated)', {
            userId,
            username: user.username,
            deletedBy: adminId,
            deleted_at: new Date()
        })

return user;
    } catch (error) {
        logger.error('Failed to delete user', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Restore soft-deleted user (admin only)
 * Reactivates a deactivated user account
 */
export async function restoreUser(userId: string, adminId: string) {
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user is actually deleted
        if (user.is_active) {
            throw new AppError('User is already active', 400);
        }

        // Restore user - reactivate account
        await user.update({
            is_active: true,
            deleted_at: null
        });

        logger.info('User restored (reactivated)', {
            userId,
            username: user.username,
            restoredBy: adminId,
            restored_at: new Date()
        });

        return user;
    } catch (error) {
        logger.error('Failed to restore user', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Permanently delete user and all associated data
 * This is irreversible - deletes files, folders, share links
 * 
 * @param userId - User ID to permanently delete
 * @param deletedBy - Admin ID who triggered deletion
 * @returns Statistics about what was deleted
 */
export async function hardDeleteUser(
    userId: string,
    deletedBy: string
): Promise<{
    filesDeleted: number;
    foldersDeleted: number;
    storageFreed: number;
    shareLinksDeactivated: number;
}> {
    const transaction = await User.sequelize!.transaction();
    
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Prevent deleting admins
        if (user.role === 'admin') {
            throw new AppError('Cannot permanently delete admin users', 403);
        }

        // Prevent self-deletion
        if (userId === deletedBy) {
            throw new AppError('Cannot delete your own account', 400);
        }

        let filesDeleted = 0;
        let storageFreed = 0;
        let foldersDeleted = 0;
        let shareLinksDeactivated = 0;

        // Step 1: Deactivate all share links
        const shareLinks = await SharedLink.update(
            { is_active: false },
            { 
                where: { created_by_user_id: userId },
                transaction 
            }
        );
        shareLinksDeactivated = shareLinks[0];

        // Step 2: Delete user's files (handle deduplication)
        const userFiles = await File.findAll({ 
            where: { user_id: userId },
            transaction 
        });

        for (const file of userFiles) {
            // Get file reference
            const ref = await FileReference.findOne({ 
                where: { file_hash: file.file_hash },
                transaction 
            });

            if (ref) {
                if (ref.reference_count === 1) {
                    // Unique file - delete physical file
                    const filePath = getFilePath(ref.file_hash, path.extname(ref.stored_path));
                    try {
                        await deleteFile(filePath);
                        storageFreed += Number(file.size);
                    } catch (error) {
                        logger.warn('Failed to delete physical file', {
                            filePath,
                            error: (error as Error).message
                        });
                    }
                    
                    // Delete file reference
                    await ref.destroy({ transaction });
                } else {
                    // Shared file - just decrement reference
                    await ref.update(
                        { reference_count: ref.reference_count - 1 },
                        { transaction }
                    );
                }
            }

            // Delete user's file record
            await file.destroy({ transaction });
            filesDeleted++;
        }

        // Step 3: Delete user's folders
        const deletedFolders = await Folder.destroy({
            where: { user_id: userId },
            transaction
        });
        foldersDeleted = deletedFolders;

        // Step 4: Anonymize activity logs (keep for audit, set user_id = null)
        await ActivityLog.update(
            { user_id: null },
            { 
                where: { user_id: userId },
                transaction 
            }
        );

        // Step 5: Delete user record
        await user.destroy({ transaction });

        // Commit transaction
        await transaction.commit();

        logger.info('User permanently deleted', {
            userId,
            username: user.username,
            deletedBy,
            filesDeleted,
            foldersDeleted,
            storageFreed,
            shareLinksDeactivated
        });

        return {
            filesDeleted,
            foldersDeleted,
            storageFreed,
            shareLinksDeactivated
        };

    } catch (error) {
        await transaction.rollback();
        logger.error('Hard delete user failed', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}