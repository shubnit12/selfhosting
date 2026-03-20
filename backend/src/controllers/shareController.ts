import { Request, Response } from 'express';
import {
    createShareLink,
    getShareLinkByToken,
    verifyShareLinkPassword,
    recordDownload,
    getUserShareLinks,
    updateShareLink,
    deactivateShareLink
} from '../services/shareLinkService';
import { getFilePath } from '../services/storageService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { ActivityAction } from '../models/ActivityLog';
import ActivityLog from '../models/ActivityLog';
import path from 'path';

// ========================================
// CREATE SHARE LINK (Authenticated)
// ========================================

/**
 * POST /api/v1/share
 * Create share link for file
 */
export async function createShare(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { file_id, password, expires_at, max_downloads, allow_preview } = req.body;

        const shareLink = await createShareLink({
            fileId: file_id,
            userId: req.user.userId,
            password,
            expiresAt: expires_at ? new Date(expires_at) : undefined,
            maxDownloads: max_downloads,
            allowPreview: allow_preview
        });

        // Log activity
        await ActivityLog.log(ActivityAction.SHARE_LINK_CREATED, {
            userId: req.user.userId,
            fileId: file_id,
            sharedLinkId: shareLink.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                has_password: !!password,
                expires_at,
                max_downloads
            }
        });

        const host = req.get('x-forwarded-host') || req.get('host');
        const origin = `${req.protocol}://${host}`;
        const publicUrl = `${origin}/share/${shareLink.token}`;

        res.status(201).json({
            message: 'Share link created successfully',
            share_link: {
                id: shareLink.id,
                token: shareLink.token,
                public_url: publicUrl,
                expires_at: shareLink.expires_at,
                max_downloads: shareLink.max_downloads,
                download_count: shareLink.download_count,
                allow_preview: shareLink.allow_preview,
                is_active: shareLink.is_active,
                created_at: shareLink.created_at
            }
        });

    } catch (error) {
        logger.error('Failed to create share link', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// GET SHARE LINK INFO (Public)
// ========================================

/**
 * GET /api/v1/share/:token
 * Get file info via share link (public, no auth)
 */
export async function getShareInfo(req: Request, res: Response): Promise<void> {
    try {
        const token = req.params.token as string;
        const info = await getShareLinkByToken(token);

        // Update last accessed
        await info.shareLink.update({
            last_accessed_at: new Date()
        });

        // Log anonymous access
        await ActivityLog.log(ActivityAction.SHARE_LINK_ACCESSED, {
            userId: undefined,  // Anonymous
            fileId: info.file.id,
            sharedLinkId: info.shareLink.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        res.json({
            file: {
                name: info.file.original_name,
                size: info.file.size,
                mime_type: info.file.mime_type
            },
            requires_password: info.requiresPassword,
            allow_preview: info.shareLink.allow_preview,
            downloads_remaining: info.downloadsRemaining,
            expires_at: info.shareLink.expires_at
        });

    } catch (error) {
        logger.error('Failed to get share info', {
            error: (error as Error).message
        });
        throw error;
    }
}

// ========================================
// VERIFY PASSWORD (Public)
// ========================================

/**
 * POST /api/v1/share/:token/verify-password
 * Verify password for protected link
 */
export async function verifyPassword(req: Request, res: Response): Promise<void> {
    try {

        const token = req.params.token as string;
        const { password } = req.body;

        const isValid = await verifyShareLinkPassword(token, password);

        if (!isValid) {
            // Log failed attempt
            await ActivityLog.log(ActivityAction.SHARE_LINK_PASSWORD_FAILED, {
                userId: undefined,
                sharedLinkId: undefined,
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'],
                details: { token: token.substring(0, 16) + '...' }
            });

            throw new AppError('Invalid password', 401);
        }

        res.json({
            valid: true,
            message: 'Password verified'
        });

    } catch (error) {
        logger.error('Password verification failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

// ========================================
// DOWNLOAD FILE (Public)
// ========================================

/**
 * GET /api/v1/share/:token/download
 * Download file via share link (public)
 */
export async function downloadSharedFile(req: Request, res: Response): Promise<void> {
    try {
        const token = req.params.token as string;
        const { password } = req.query;

        const info = await getShareLinkByToken(token);

        // Verify password if required
        if (info.requiresPassword) {
            if (!password) {
                throw new AppError('Password required', 401);
            }

            const isValid = await verifyShareLinkPassword(token, password as string);
            if (!isValid) {
                throw new AppError('Invalid password', 401);
            }
        }

        // Record download
        await recordDownload(token);

        // Log download
        await ActivityLog.log(ActivityAction.SHARE_LINK_DOWNLOADED, {
            userId: undefined,  // Anonymous
            fileId: info.file.id,
            sharedLinkId: info.shareLink.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        // Get file path
        const filePath = getFilePath(info.file.file_hash, path.extname(info.file.original_name));

        // Send file
        res.download(filePath, info.file.original_name);

    } catch (error) {
        logger.error('Download failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

// ========================================
// GET USER'S SHARE LINKS (Authenticated)
// ========================================

/**
 * GET /api/v1/share/my-links
 * Get user's share links
 */
export async function getMyShareLinks(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const activeOnly = req.query.active_only !== 'false';

        const shareLinks = await getUserShareLinks(req.user.userId, activeOnly);
        const host = req.get('x-forwarded-host') || req.get('host');
        const origin = `${req.protocol}://${host}`;

        res.json({
            share_links: shareLinks.map(sl => ({
                id: sl.id,
                token: sl.token,
                public_url: `${origin}/share/${sl.token}`,
                file: {
                    id: sl.file!.id,
                    name: sl.file!.original_name,
                    size: sl.file!.size
                },
                has_password: !!sl.password_hash,
                expires_at: sl.expires_at,
                max_downloads: sl.max_downloads,
                download_count: sl.download_count,
                is_active: sl.is_active,
                created_at: sl.created_at,
                last_accessed_at: sl.last_accessed_at
            }))
        });

    } catch (error) {
        logger.error('Failed to get share links', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// UPDATE SHARE LINK (Authenticated)
// ========================================

/**
 * PUT /api/v1/share/:id
 * Update share link settings
 */
export async function updateShare(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;
        const { expires_at, max_downloads, is_active, password } = req.body;

        const shareLink = await updateShareLink(id, req.user.userId, {
            expires_at: expires_at ? new Date(expires_at) : undefined,
            max_downloads,
            is_active,
            password
        });

        res.json({
            message: 'Share link updated successfully',
            share_link: {
                id: shareLink.id,
                expires_at: shareLink.expires_at,
                max_downloads: shareLink.max_downloads,
                is_active: shareLink.is_active
            }
        });

    } catch (error) {
        logger.error('Failed to update share link', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// DELETE SHARE LINK (Authenticated)
// ========================================

/**
 * DELETE /api/v1/share/:id
 * Deactivate share link
 */
export async function deleteShare(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        await deactivateShareLink(id, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.SHARE_LINK_DEACTIVATED, {
            userId: req.user.userId,
            sharedLinkId: id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        res.json({
            message: 'Share link deactivated'
        });

    } catch (error) {
        logger.error('Failed to deactivate share link', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}
