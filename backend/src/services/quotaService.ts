import { User, File } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';

// ========================================
// INTERFACES
// ========================================

interface QuotaInfo {
    quota: number | null;      // null = unlimited (admin)
    used: number;              // Bytes used
    available: number | null;  // null = unlimited
    percentage: number;        // 0-100
}

// ========================================
// QUOTA CHECKING
// ========================================

/**
 * Get user's storage quota information
 * 
 * @param userId - User ID
 * @returns Quota information
 */
export async function getUserQuota(userId: string): Promise<QuotaInfo> {
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const quota = user.storage_quota;  // null = unlimited
        const used = user.storage_used;

        // Calculate available space
        const available = quota === null ? null : quota - used;

        // Calculate percentage used
        const percentage = quota === null ? 0 : (used / quota) * 100;

        logger.debug('Quota info retrieved', {
            userId,
            quota,
            used,
            available,
            percentage: percentage.toFixed(2) + '%'
        });

        return {
            quota,
            used,
            available,
            percentage
        };

    } catch (error) {
        logger.error('Failed to get quota info', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Check if user has enough storage space for upload
 * 
 * @param userId - User ID
 * @param fileSize - Size of file to upload (bytes)
 * @returns true if user has space, false otherwise
 */
export async function hasStorageSpace(
    userId: string,
    fileSize: number
): Promise<boolean> {
    try {
        const quotaInfo = await getUserQuota(userId);

        // Admin (unlimited quota)
        if (quotaInfo.quota === null) {
            logger.debug('User has unlimited storage (admin)', { userId });
            return true;
        }

        // Check if enough space
        const hasSpace = quotaInfo.available !== null && quotaInfo.available >= fileSize;

        if (!hasSpace) {
            logger.warn('Insufficient storage space', {
                userId,
                required: fileSize,
                available: quotaInfo.available,
                quota: quotaInfo.quota
            });
        }

        return hasSpace;

    } catch (error) {
        logger.error('Storage space check failed', {
            error: (error as Error).message,
            userId,
            fileSize
        });
        throw error;
    }
}

/**
 * Validate user has quota for upload (throws error if not)
 * 
 * @param userId - User ID
 * @param fileSize - File size in bytes
 * @throws Error if insufficient storage
 */
export async function validateStorageQuota(
    userId: string,
    fileSize: number
): Promise<void> {
    const hasSpace = await hasStorageSpace(userId, fileSize);

    if (!hasSpace) {
        const quotaInfo = await getUserQuota(userId);
        
        throw new Error(
            `Insufficient storage. Required: ${formatBytes(fileSize)}, ` +
            `Available: ${formatBytes(quotaInfo.available || 0)}, ` +
            `Quota: ${formatBytes(quotaInfo.quota || 0)}`
        );
    }
}

// ========================================
// QUOTA UPDATES
// ========================================

/**
 * Add file size to user's storage usage
 * 
 * @param userId - User ID
 * @param fileSize - File size to add (bytes)
 */
export async function addToStorageUsed(
    userId: string,
    fileSize: number
): Promise<void> {
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        await user.increment('storage_used', { by: fileSize });
        await user.reload();

        logger.info('Storage usage updated', {
            userId,
            added: formatBytes(fileSize),
            newTotal: formatBytes(user.storage_used)
        });

    } catch (error) {
        logger.error('Failed to update storage usage', {
            error: (error as Error).message,
            userId,
            fileSize
        });
        throw error;
    }
}

/**
 * Subtract file size from user's storage usage
 * 
 * @param userId - User ID
 * @param fileSize - File size to subtract (bytes)
 */
export async function subtractFromStorageUsed(
    userId: string,
    fileSize: number
): Promise<void> {
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        await user.decrement('storage_used', { by: fileSize });
        await user.reload();

        logger.info('Storage usage decreased', {
            userId,
            removed: formatBytes(fileSize),
            newTotal: formatBytes(user.storage_used)
        });

    } catch (error) {
        logger.error('Failed to decrease storage usage', {
            error: (error as Error).message,
            userId,
            fileSize
        });
        throw error;
    }
}

/**
 * Recalculate user's actual storage usage from database
 * Useful for fixing discrepancies
 * 
 * @param userId - User ID
 * @returns Actual storage used
 */
export async function recalculateStorageUsed(userId: string): Promise<number> {
    try {
        // Sum all non-deleted file sizes for user
        const result = await File.sum('size', {
            where: {
                user_id: userId,
                is_deleted: false,
                is_available: true  // Only count completed uploads
            }
        });

        const actualUsed = result || 0;

        // Update user record
        const user = await User.findByPk(userId);
        if (user) {
            await user.update({ storage_used: actualUsed });
            
            logger.info('Storage usage recalculated', {
                userId,
                actualUsed: formatBytes(actualUsed)
            });
        }

        return actualUsed;

    } catch (error) {
        logger.error('Storage recalculation failed', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}