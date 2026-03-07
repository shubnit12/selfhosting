import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { SharedLink, File } from '../models';
import { BCRYPT_CONFIG } from '../config/constants';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ========================================
// INTERFACES
// ========================================

interface CreateShareLinkOptions {
    fileId: string;
    userId: string;
    password?: string;
    expiresAt?: Date;
    maxDownloads?: number;
    allowPreview?: boolean;
}

interface ShareLinkInfo {
    shareLink: SharedLink;
    file: File;
    requiresPassword: boolean;
    isExpired: boolean;
    downloadsRemaining: number | null;
}

// ========================================
// CREATE SHARE LINK
// ========================================

/**
 * Create shareable link for file
 * 
 * @param options - Share link options
 * @returns Created share link
 */
export async function createShareLink(
    options: CreateShareLinkOptions
): Promise<SharedLink> {
    try {
        const { fileId, userId, password, expiresAt, maxDownloads, allowPreview } = options;

        // Verify file exists and user owns it
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        if (file.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        if (file.is_deleted) {
            throw new AppError('Cannot share deleted file', 400);
        }

        // Hash password if provided
        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, BCRYPT_CONFIG.SALT_ROUNDS);
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Create share link
        const shareLink = await SharedLink.create({
            file_id: fileId,
            created_by_user_id: userId,
            token,
            password_hash: passwordHash,
            expires_at: expiresAt || null,
            max_downloads: maxDownloads || null,
            allow_preview: allowPreview !== false
        });

        logger.info('Share link created', {
            shareLinkId: shareLink.id,
            fileId,
            userId,
            hasPassword: !!password,
            expiresAt,
            maxDownloads
        });

        return shareLink;

    } catch (error) {
        logger.error('Failed to create share link', {
            error: (error as Error).message,
            fileId: options.fileId
        });
        throw error;
    }
}

// ========================================
// GET SHARE LINK INFO
// ========================================

/**
 * Get share link information by token (public access)
 * 
 * @param token - Share link token
 * @returns Share link info
 */
export async function getShareLinkByToken(token: string): Promise<ShareLinkInfo> {
    try {
        const shareLink = await SharedLink.findOne({
            where: { token },
            include: ['file']
        });

        if (!shareLink) {
            throw new AppError('Share link not found', 404);
        }

        if (!shareLink.is_active) {
            throw new AppError('Share link has been deactivated', 403);
        }

        const isExpired = shareLink.isExpired();
        const isLimitReached = shareLink.isDownloadLimitReached();

        if (isExpired) {
            throw new AppError('Share link has expired', 403);
        }

        if (isLimitReached) {
            throw new AppError('Download limit reached', 403);
        }

        const downloadsRemaining = shareLink.max_downloads 
            ? shareLink.max_downloads - shareLink.download_count
            : null;

        logger.debug('Share link accessed', {
            token: token.substring(0, 16) + '...',
            fileId: shareLink.file_id
        });

        return {
            shareLink,
            file: shareLink.file!,
            requiresPassword: !!shareLink.password_hash,
            isExpired,
            downloadsRemaining
        };

    } catch (error) {
        logger.error('Failed to get share link', {
            error: (error as Error).message,
            token: token.substring(0, 16) + '...'
        });
        throw error;
    }
}

// ========================================
// PASSWORD VERIFICATION
// ========================================

/**
 * Verify password for protected share link
 * 
 * @param token - Share link token
 * @param password - Password to verify
 * @returns true if password correct
 */
export async function verifyShareLinkPassword(
    token: string,
    password: string
): Promise<boolean> {
    try {
        const shareLink = await SharedLink.findOne({
            where: { token }
        });

        if (!shareLink) {
            throw new AppError('Share link not found', 404);
        }

        if (!shareLink.password_hash) {
            // No password required
            return true;
        }

        const isValid = await bcrypt.compare(password, shareLink.password_hash);

        if (!isValid) {
            logger.warn('Invalid password attempt for share link', {
                token: token.substring(0, 16) + '...'
            });
        }

        return isValid;

    } catch (error) {
        logger.error('Password verification failed', {
            error: (error as Error).message,
            token: token.substring(0, 16) + '...'
        });
        throw error;
    }
}

// ========================================
// DOWNLOAD TRACKING
// ========================================

/**
 * Record download and update last accessed time
 * 
 * @param token - Share link token
 */
export async function recordDownload(token: string): Promise<void> {
    try {
        const shareLink = await SharedLink.findOne({
            where: { token }
        });

        if (!shareLink) {
            throw new AppError('Share link not found', 404);
        }

        // Increment download count and update last accessed
        await shareLink.increment('download_count');
        await shareLink.update({
            last_accessed_at: new Date()
        });

        logger.info('Download recorded', {
            token: token.substring(0, 16) + '...',
            downloadCount: shareLink.download_count + 1
        });

    } catch (error) {
        logger.error('Failed to record download', {
            error: (error as Error).message,
            token: token.substring(0, 16) + '...'
        });
        throw error;
    }
}

// ========================================
// GET USER'S SHARE LINKS
// ========================================

/**
 * Get user's share links
 * 
 * @param userId - User ID
 * @param activeOnly - Only return active links
 * @returns List of share links
 */
export async function getUserShareLinks(
    userId: string,
    activeOnly: boolean = true
): Promise<SharedLink[]> {
    try {
        const where: any = {
            created_by_user_id: userId
        };

        if (activeOnly) {
            where.is_active = true;
        }

        const shareLinks = await SharedLink.findAll({
            where,
            include: ['file'],
            order: [['created_at', 'DESC']]
        });

        logger.debug('User share links retrieved', {
            userId,
            count: shareLinks.length
        });

        return shareLinks;

    } catch (error) {
        logger.error('Failed to get user share links', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

// ========================================
// UPDATE/DEACTIVATE SHARE LINK
// ========================================

/**
 * Update share link settings
 * 
 * @param shareLinkId - Share link ID
 * @param userId - User ID (for authorization)
 * @param updates - Fields to update
 * @returns Updated share link
 */
export async function updateShareLink(
    shareLinkId: string,
    userId: string,
    updates: {
        expires_at?: Date | null;
        max_downloads?: number | null;
        is_active?: boolean;
        password?: string;
    }
): Promise<SharedLink> {
    try {
        const shareLink = await SharedLink.findByPk(shareLinkId);

        if (!shareLink) {
            throw new AppError('Share link not found', 404);
        }

        if (shareLink.created_by_user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        const updateData: any = {};

        if (updates.expires_at !== undefined) {
            updateData.expires_at = updates.expires_at;
        }

        if (updates.max_downloads !== undefined) {
            updateData.max_downloads = updates.max_downloads;
        }

        if (updates.is_active !== undefined) {
            updateData.is_active = updates.is_active;
        }

        if (updates.password) {
            updateData.password_hash = await bcrypt.hash(updates.password, BCRYPT_CONFIG.SALT_ROUNDS);
        }

        await shareLink.update(updateData);

        logger.info('Share link updated', {
            shareLinkId,
            userId,
            updates: Object.keys(updateData)
        });

        return shareLink;

    } catch (error) {
        logger.error('Failed to update share link', {
            error: (error as Error).message,
            shareLinkId
        });
        throw error;
    }
}

/**
 * Deactivate share link
 * 
 * @param shareLinkId - Share link ID
 * @param userId - User ID (for authorization)
 */
export async function deactivateShareLink(
    shareLinkId: string,
    userId: string
): Promise<void> {
    try {
        await updateShareLink(shareLinkId, userId, { is_active: false });

        logger.info('Share link deactivated', {
            shareLinkId,
            userId
        });

    } catch (error) {
        logger.error('Failed to deactivate share link', {
            error: (error as Error).message,
            shareLinkId
        });
        throw error;
    }
}