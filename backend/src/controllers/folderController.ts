import { Request, Response } from 'express';
import { 
    createFolder, 
    getFolders, 
    getFolderById,
    renameFolder,
    deleteFolder,
    restoreFolder,
    getTrashedFolders,
    getFolderTree
} from '../services/folderService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { ActivityAction } from '../models/ActivityLog';
import ActivityLog from '../models/ActivityLog';
import { makeFolderPublic, makeFolderPrivate } from '../services/folderService';


// ========================================
// CREATE FOLDER
// ========================================

/**
 * POST /api/v1/folders
 * Create new folder
 */
export async function createFolderHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { name, parent_folder_id } = req.body;

        const folder = await createFolder(
            req.user.userId,
            name,
            parent_folder_id || null
        );

        // Log activity
        await ActivityLog.log(ActivityAction.CREATE_FOLDER, {
            userId: req.user.userId,
            folderId: folder.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                folder_name: folder.name,
                path: folder.path
            }
        });

        res.status(201).json({
            message: 'Folder created successfully',
            folder: {
                id: folder.id,
                name: folder.name,
                path: folder.path,
                parent_folder_id: folder.parent_folder_id,
                created_at: folder.created_at
            }
        });

    } catch (error) {
        logger.error('Failed to create folder', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// GET FOLDERS
// ========================================

/**
 * GET /api/v1/folders
 * List user's folders
 */
export async function listFolders(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const parent_folder_id = req.query.parent_folder_id as string | undefined;

        const folders = await getFolders(
            req.user.userId,
            parent_folder_id || null
        );

        res.json({
            folders: folders.map(f => ({
                id: f.id,
                name: f.name,
                path: f.path,
                parent_folder_id: f.parent_folder_id,
                created_at: f.created_at
            }))
        });

    } catch (error) {
        logger.error('Failed to list folders', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/folders/:id
 * Get folder by ID
 */
export async function getFolder(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        const folder = await getFolderById(id, req.user.userId);

        res.json({
            folder: {
                id: folder.id,
                name: folder.name,
                path: folder.path,
                parent_folder_id: folder.parent_folder_id,
                created_at: folder.created_at,
                updated_at: folder.updated_at
            }
        });

    } catch (error) {
        logger.error('Failed to get folder', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// RENAME FOLDER
// ========================================

/**
 * PUT /api/v1/folders/:id
 * Rename folder
 */
export async function renameFolderHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;
        const { name } = req.body;

        const folder = await renameFolder(id, name, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.RENAME_FOLDER, {
            userId: req.user.userId,
            folderId: folder.id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
            details: {
                new_name: name,
                path: folder.path
            }
        });

        res.json({
            message: 'Folder renamed successfully',
            folder: {
                id: folder.id,
                name: folder.name,
                path: folder.path
            }
        });

    } catch (error) {
        logger.error('Failed to rename folder', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// DELETE FOLDER
// ========================================

/**
 * DELETE /api/v1/folders/:id
 * Soft delete folder
 */
export async function deleteFolderHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        await deleteFolder(id, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.DELETE_FOLDER, {
            userId: req.user.userId,
            folderId: id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        res.json({
            message: 'Folder moved to trash'
        });

    } catch (error) {
        logger.error('Failed to delete folder', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// RESTORE FOLDER
// ========================================

/**
 * POST /api/v1/folders/:id/restore
 * Restore folder from trash
 */
export async function restoreFolderHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const id = req.params.id as string;

        await restoreFolder(id, req.user.userId);

        // Log activity
        await ActivityLog.log(ActivityAction.RESTORE_FOLDER, {
            userId: req.user.userId,
            folderId: id,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent']
        });

        res.json({
            message: 'Folder restored from trash'
        });

    } catch (error) {
        logger.error('Failed to restore folder', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// GET TRASHED FOLDERS
// ========================================

/**
 * GET /api/v1/folders/trash
 * Get trashed folders
 */
export async function getTrashedFoldersHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const folders = await getTrashedFolders(req.user.userId);

        res.json({
            folders: folders.map(f => ({
                id: f.id,
                name: f.name,
                path: f.path,
                parent_folder_id: f.parent_folder_id,
                deleted_at: f.deleted_at,
                days_until_permanent_delete: Math.max(0, 30 - Math.floor((Date.now() - new Date(f.deleted_at!).getTime()) / (1000 * 60 * 60 * 24)))
            }))
        });

    } catch (error) {
        logger.error('Failed to get trashed folders', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

/**
 * GET /api/v1/folders/tree
 * Get complete folder tree with files
 */
export async function getFolderTreeHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const tree = await getFolderTree(req.user.userId);

        res.json({
            tree
        });

    } catch (error) {
        logger.error('Failed to get folder tree', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}



/**
 * PUT /api/v1/folders/:id/public
 * Make folder public with custom slug
 */
export async function makePublic(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        // Check if user is admin
if (req.user.role !== 'admin') {
    throw new AppError('Admin access required to make folders public', 403);
}

        const folderId = req.params.id as string;
        const { slug } = req.body;

        if (!slug) {
            throw new AppError('Slug is required', 400);
        }

        const folder = await makeFolderPublic(folderId, slug, req.user.userId);

        res.json({
            message: 'Folder is now public',
            folder: {
                id: folder.id,
                name: folder.name,
                is_public: folder.is_public,
                public_slug: folder.public_slug,
                public_url: `/api/v1/public/folders/${folder.public_slug}`
            }
        });
    } catch (error) {
        logger.error('Make folder public failed', {
            error: (error as Error).message,
            folderId: req.params.id
        });
        throw error;
    }
}

/**
 * DELETE /api/v1/folders/:id/public
 * Make folder private
 */
export async function makePrivate(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }
        if (req.user.role !== 'admin') {
    throw new AppError('Admin access required to make folders private', 403);
}

        const folderId = req.params.id as string;
        const folder = await makeFolderPrivate(folderId, req.user.userId);

        res.json({
            message: 'Folder is now private',
            folder: {
                id: folder.id,
                name: folder.name,
                is_public: folder.is_public
            }
        });
    } catch (error) {
        logger.error('Make folder private failed', {
            error: (error as Error).message,
            folderId: req.params.id
        });
        throw error;
    }
}