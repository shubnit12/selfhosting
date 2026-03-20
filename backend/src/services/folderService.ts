import fs from 'fs';
import path from 'path';
import { Folder, File, FileReference } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { deleteFile, getFilePath } from './storageService';
import { subtractFromStorageUsed } from './quotaService';


// ========================================
// INTERFACES
// ========================================

interface FolderTree {
    id: string;
    name: string;
    path: string;
    parent_folder_id: string | null;
    is_public: boolean;
    public_slug: string | null;
    subfolders: FolderTree[];
    created_at: Date;
    file_count: number;
    files: {
        id: string;
        original_name: string;
        size: number;
        mime_type: string;
        created_at: Date;
    }[];
    subfolder_count: number;
}

// ========================================
// CREATE FOLDER
// ========================================

/**
 * Create new folder
 * 
 * @param userId - User ID
 * @param name - Folder name
 * @param parentFolderId - Parent folder ID (null = root)
 * @returns Created folder
 */
export async function createFolder(
    userId: string,
    name: string,
    parentFolderId: string | null = null
): Promise<Folder> {
    try {
        // Build folder path
        let folderPath = `/${name}`;

        if (parentFolderId) {
            const parentFolder = await Folder.findByPk(parentFolderId);

            if (!parentFolder) {
                throw new AppError('Parent folder not found', 404);
            }

            if (parentFolder.user_id !== userId) {
                throw new AppError('Unauthorized', 403);
            }

            folderPath = `${parentFolder.path}/${name}`;
        }

        // Check if folder with same name exists in same location
        const existingFolder = await Folder.findOne({
            where: {
                user_id: userId,
                parent_folder_id: parentFolderId,
                name: name,
                is_deleted: false
            }
        });

        if (existingFolder) {
            throw new AppError('Folder with this name already exists in this location', 409);
        }

        // Create folder
        const folder = await Folder.create({
            user_id: userId,
            name,
            path: folderPath,
            parent_folder_id: parentFolderId
        });

        logger.info('Folder created', {
            folderId: folder.id,
            userId,
            name,
            path: folderPath
        });

        return folder;

    } catch (error) {
        logger.error('Failed to create folder', {
            error: (error as Error).message,
            userId,
            name
        });
        throw error;
    }
}

// ========================================
// GET FOLDERS
// ========================================

/**
 * Get user's folders (optionally filtered by parent)
 * 
 * @param userId - User ID
 * @param parentFolderId - Parent folder ID (null = root folders)
 * @returns List of folders
 */
export async function getFolders(
    userId: string,
    parentFolderId: string | null = null
): Promise<Folder[]> {
    try {
        const folders = await Folder.findAll({
            where: {
                user_id: userId,
                parent_folder_id: parentFolderId,
                is_deleted: false
            },
            order: [['name', 'ASC']]
        });

        logger.debug('Folders retrieved', {
            userId,
            parentFolderId,
            count: folders.length
        });

        return folders;

    } catch (error) {
        logger.error('Failed to get folders', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}

/**
 * Get folder by ID
 * 
 * @param folderId - Folder ID
 * @param userId - User ID (for authorization)
 * @returns Folder
 */
export async function getFolderById(
    folderId: string,
    userId: string
): Promise<Folder> {
    try {
        const folder = await Folder.findByPk(folderId);

        if (!folder) {
            throw new AppError('Folder not found', 404);
        }

        if (folder.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        if (folder.is_deleted) {
            throw new AppError('Folder is in trash', 404);
        }

        return folder;

    } catch (error) {
        logger.error('Failed to get folder', {
            error: (error as Error).message,
            folderId,
            userId
        });
        throw error;
    }
}

// ========================================
// RENAME FOLDER
// ========================================

/**
 * Rename folder and update paths of all subfolders/files
 * 
 * @param folderId - Folder ID
 * @param newName - New folder name
 * @param userId - User ID (for authorization)
 * @returns Updated folder
 */
export async function renameFolder(
    folderId: string,
    newName: string,
    userId: string
): Promise<Folder> {
    try {
        const folder = await getFolderById(folderId, userId);

        const oldPath = folder.path;
        const pathParts = oldPath.split('/').filter(p => p);
        pathParts[pathParts.length - 1] = newName;
        const newPath = '/' + pathParts.join('/');

        // Update folder
        // await folder.update({
        //     name: newName,
        //     path: newPath
        // });
        const updates: any = { name: newName, path: newPath };
if (folder.is_public) {
    const baseSlug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!baseSlug) {
        throw new AppError('New folder name cannot generate a valid slug', 400);
    }
    const existing = await Folder.findOne({ where: { public_slug: baseSlug } });
    if (existing && existing.id !== folderId) {
        throw new AppError(`Slug "${baseSlug}" is already taken by another public folder`, 409);
    }
    updates.public_slug = baseSlug;
}
await folder.update(updates);
        // Update all subfolder paths
        const subfolders = await Folder.findAll({
            where: {
                user_id: userId,
                path: {
                    [Op.like]: `${oldPath}/%`
                }
            }
        });

        for (const subfolder of subfolders) {
            const updatedPath = subfolder.path.replace(oldPath, newPath);
            await subfolder.update({ path: updatedPath });
        }

        logger.info('Folder renamed', {
            folderId,
            oldName: folder.name,
            newName,
            subfolders: subfolders.length
        });

        return folder;

    } catch (error) {
        logger.error('Failed to rename folder', {
            error: (error as Error).message,
            folderId
        });
        throw error;
    }
}

// ========================================
// DELETE FOLDER
// ========================================

/**
 * Soft delete folder and all contents
 * 
 * @param folderId - Folder ID
 * @param userId - User ID (for authorization)
 */
export async function deleteFolder(
    folderId: string,
    userId: string
): Promise<void> {
    try {
        const folder = await getFolderById(folderId, userId);

        // Soft delete folder
        await folder.update({
            is_deleted: true,
            deleted_at: new Date(),
            is_public: false,
            public_slug: null
        });

        // Soft delete all subfolders
        await Folder.update(
            {
                is_deleted: true,
                deleted_at: new Date(),
                is_public: false,
                public_slug: null
            },
            {
                where: {
                    user_id: userId,
                    path: {
                        [Op.like]: `${folder.path}/%`
                    }
                }
            }
        );

        // Get all folder IDs being deleted (parent + subfolders)
        const foldersToDelete = await Folder.findAll({
            where: {
                user_id: userId,
                [Op.or]: [
                    { id: folderId },  // Parent folder
                    {
                        path: {
                            [Op.like]: `${folder.path}/%`  // All subfolders
                        }
                    }
                ]
            },
            attributes: ['id']
        });

        const folderIds = foldersToDelete.map(f => f.id);

        // Soft delete all files in these folders
        await File.update(
            {
                is_deleted: true,
                deleted_at: new Date()
            },
            {
                where: {
                    user_id: userId,
                    folder_id: {
                        [Op.in]: folderIds  // ✅ Delete files from ALL affected folders
                    }
                }
            }
        );

        logger.info('Folder deleted (with contents)', {
            folderId,
            userId,
            folderName: folder.name
        });

    } catch (error) {
        logger.error('Failed to delete folder', {
            error: (error as Error).message,
            folderId,
            userId
        });
        throw error;
    }
}

// ========================================
// PERMANENT DELETE FOLDER
// ========================================

/**
 * Permanently delete a folder and all its contents from DB and disk
 * Only works on folders that are already soft-deleted (in trash)
 * 
 * @param folderId - Folder ID
 * @param userId - User ID (for authorization)
 */
export async function permanentDeleteFolder(
    folderId: string,
    userId: string
): Promise<void> {
    try {
        const folder = await Folder.findByPk(folderId);

        if (!folder) {
            throw new AppError('Folder not found', 404);
        }

        if (folder.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        if (!folder.is_deleted) {
            throw new AppError('Folder must be in trash before permanently deleting', 400);
        }

        // Collect all folder IDs (this folder + all subfolders)
        const allFolders = await Folder.findAll({
            where: {
                user_id: userId,
                [Op.or]: [
                    { id: folderId },
                    { path: { [Op.like]: `${folder.path}/%` } }
                ]
            },
            attributes: ['id']
        });

        const folderIds = allFolders.map(f => f.id);

        // Find all files in these folders
        const files = await File.findAll({
            where: {
                user_id: userId,
                folder_id: { [Op.in]: folderIds }
            }
        });

        // Permanently delete each file
        for (const file of files) {
            try {
                const ref = await FileReference.findOne({
                    where: { file_hash: file.file_hash }
                });

                if (ref) {
                    if (ref.reference_count <= 1) {
                        const filePath = getFilePath(ref.file_hash, path.extname(ref.stored_path));
                        if (fs.existsSync(filePath)) {
                            await deleteFile(filePath);
                        }
                        await ref.destroy();
                    } else {
                        await ref.update({ reference_count: ref.reference_count - 1 });
                    }
                }

                await subtractFromStorageUsed(userId, Number(file.size));
                await file.destroy();
            } catch (error) {
                logger.error('Failed to permanently delete file during folder deletion', {
                    error: (error as Error).message,
                    fileId: file.id
                });
            }
        }

        // Hard delete all folders
        await Folder.destroy({
            where: {
                user_id: userId,
                [Op.or]: [
                    { id: folderId },
                    { path: { [Op.like]: `${folder.path}/%` } }
                ]
            }
        });

        logger.info('Folder permanently deleted', {
            folderId,
            userId,
            folderName: folder.name,
            filesDeleted: files.length,
            foldersDeleted: folderIds.length
        });

    } catch (error) {
        logger.error('Failed to permanently delete folder', {
            error: (error as Error).message,
            folderId,
            userId
        });
        throw error;
    }
}

/**
 * Restore folder from trash
 * 
 * @param folderId - Folder ID
 * @param userId - User ID (for authorization)
 */
export async function restoreFolder(
    folderId: string,
    userId: string
): Promise<void> {
    try {
        const folder = await Folder.findByPk(folderId);

        if (!folder) {
            throw new AppError('Folder not found', 404);
        }

        if (folder.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        if (!folder.is_deleted) {
            throw new AppError('Folder is not in trash', 400);
        }

        // Restore folder
        await folder.update({
            is_deleted: false,
            deleted_at: null
        });

        // Cascade-restore parent folder chain so this folder is reachable
        const restoredParentIds: string[] = [];
        let currentParentId: string | null = folder.parent_folder_id;

        while (currentParentId) {
            const parentFolder: Folder | null = await Folder.findByPk(currentParentId);

            if (!parentFolder || parentFolder.user_id !== userId) break;

            if (parentFolder.is_deleted) {
                await parentFolder.update({
                    is_deleted: false,
                    deleted_at: null
                });
                restoredParentIds.push(parentFolder.id);
                logger.info('Parent folder cascade-restored', {
                    folderId: parentFolder.id,
                    folderName: parentFolder.name,
                    restoredForFolderId: folderId
                });
            }

            currentParentId = parentFolder.parent_folder_id;
        }

        if (restoredParentIds.length > 0) {
            logger.info('Cascade restored parent folders for folder', {
                folderId,
                folderName: folder.name,
                restoredParentIds
            });
        }

        // Restore subfolders
        await Folder.update(
            {
                is_deleted: false,
                deleted_at: null
            },
            {
                where: {
                    user_id: userId,
                    path: {
                        [Op.like]: `${folder.path}/%`
                    }
                }
            }
        );

        // Restore all files in folder and subfolders 
        // Get all folder IDs being restored (parent + subfolders)
        const foldersToRestore = await Folder.findAll({
            where: {
                user_id: userId,
                [Op.or]: [
                    { id: folderId },  // Parent folder
                    {
                        path: {
                            [Op.like]: `${folder.path}/%`  // All subfolders
                        }
                    }
                ]
            },
            attributes: ['id']
        });

        const folderIds = foldersToRestore.map(f => f.id);

        // Restore all files in these folders
        await File.update(
            {
                is_deleted: false,
                deleted_at: null
            },
            {
                where: {
                    user_id: userId,
                    folder_id: {
                        [Op.in]: folderIds  // ✅ Restore files from ALL affected folders
                    }
                }
            }
        );
        logger.info('Folder restored (with contents)', {
            folderId,
            userId,
            folderName: folder.name
        });

    } catch (error) {
        logger.error('Failed to restore folder', {
            error: (error as Error).message,
            folderId,
            userId
        });
        throw error;
    }
}

/**
 * Get user's trashed folders
 * 
 * @param userId - User ID
 * @returns List of deleted folders
 */
export async function getTrashedFolders(userId: string): Promise<Folder[]> {
    try {
        const folders = await Folder.findAll({
            where: {
                user_id: userId,
                is_deleted: true
            },
            order: [['deleted_at', 'DESC']]  // Most recently deleted first
        });

        logger.debug('Trashed folders retrieved', {
            userId,
            count: folders.length
        });

        return folders;

    } catch (error) {
        logger.error('Failed to get trashed folders', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}


/**
 * Get complete folder tree with files
 * Returns hierarchical structure of all folders and files
 * 
 * @param userId - User ID
 * @returns Complete folder tree with files
 */
export async function getFolderTree(userId: string): Promise<FolderTree[]> {
    try {
        // Get all non-deleted folders for user
        const allFolders = await Folder.findAll({
            where: {
                user_id: userId,
                is_deleted: false
            },
            order: [['name', 'ASC']]
        });

        // Get all non-deleted files for user
        const allFiles = await File.findAll({
            where: {
                user_id: userId,
                is_deleted: false,
                is_available: true
            },
            order: [['original_name', 'ASC']]
        });

        // Build tree recursively starting from root folders
        const rootFolders = allFolders.filter(f => f.parent_folder_id === null);
        
        const tree = rootFolders.map(folder => 
            buildFolderNode(folder, allFolders, allFiles)
        );

        logger.debug('Folder tree generated', {
            userId,
            totalFolders: allFolders.length,
            totalFiles: allFiles.length,
            rootFolders: rootFolders.length
        });

        return tree;

    } catch (error) {
        logger.error('Failed to get folder tree', {
            error: (error as Error).message,
            userId
        });
        throw error;
    }
}


/**
 * Get all public folders
 */
export async function getPublicFolders() {
    try {
        const publicFolders = await Folder.findAll({
            where: {
                is_public: true,
                is_deleted: false
            },
            attributes: ['id', 'name', 'public_slug', 'path', 'created_at'],
            order: [['name', 'ASC']]
        });

        logger.debug('Public folders retrieved', {
            count: publicFolders.length
        });

        return publicFolders;
    } catch (error) {
        logger.error('Failed to get public folders', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Get public folder by slug with files
 */
export async function getPublicFolderBySlug(slug: string) {
    try {
        const folder = await Folder.findOne({
            where: {
                public_slug: slug,
                is_public: true,
                is_deleted: false
            }
        });

        if (!folder) {
            throw new AppError('Public folder not found', 404);
        }

        // Get files in this folder
        const files = await File.findAll({
            where: {
                folder_id: folder.id,
                is_deleted: false,
                is_available: true
            },
            attributes: ['id', 'original_name', 'size', 'mime_type', 'thumbnail_path', 'created_at'],
            order: [['original_name', 'ASC']]
        });

        logger.debug('Public folder retrieved', {
            slug,
            folderId: folder.id,
            fileCount: files.length
        });

        return {
            folder: {
                id: folder.id,
                name: folder.name,
                slug: folder.public_slug,
                path: folder.path
            },
            files
        };
    } catch (error) {
        logger.error('Failed to get public folder', {
            error: (error as Error).message,
            slug
        });
        throw error;
    }
}

/**
 * Make folder public with custom slug
 */
export async function makeFolderPublic(
    folderId: string,
    slug: string,
    userId: string
) {
    try {
        const folder = await Folder.findByPk(folderId);

        if (!folder) {
            throw new AppError('Folder not found', 404);
        }

        if (folder.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        // Validate slug format (alphanumeric + hyphens only)
        if (!/^[a-z0-9-]+$/.test(slug)) {
            throw new AppError('Slug must contain only lowercase letters, numbers, and hyphens', 400);
        }

        // Check if slug already taken
        const existingSlug = await Folder.findOne({
            where: { public_slug: slug }
        });

        if (existingSlug && existingSlug.id !== folderId) {
            throw new AppError('Slug already taken', 409);
        }

        await folder.update({
            is_public: true,
            public_slug: slug
        });

        logger.info('Folder made public', {
            folderId,
            folderName: folder.name,
            slug,
            userId
        });

        return folder;
    } catch (error) {
        logger.error('Failed to make folder public', {
            error: (error as Error).message,
            folderId
        });
        throw error;
    }
}

/**
 * Make folder private (remove public access)
 */
export async function makeFolderPrivate(
    folderId: string,
    userId: string
) {
    try {
        const folder = await Folder.findByPk(folderId);

        if (!folder) {
            throw new AppError('Folder not found', 404);
        }

        if (folder.user_id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        await folder.update({
            is_public: false,
            public_slug: null
        });

        logger.info('Folder made private', {
            folderId,
            folderName: folder.name,
            userId
        });

        return folder;
    } catch (error) {
        logger.error('Failed to make folder private', {
            error: (error as Error).message,
            folderId
        });
        throw error;
    }
}

/**
 * Helper: Build folder node recursively
 */
function buildFolderNode(
    folder: Folder,
    allFolders: Folder[],
    allFiles: File[]
): FolderTree {
    // Find subfolders
    const subfolders = allFolders
        .filter(f => f.parent_folder_id === folder.id)
        .map(subfolder => buildFolderNode(subfolder, allFolders, allFiles));

    // Find files in this folder
    const files = allFiles.filter(f => f.folder_id === folder.id);

    return {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent_folder_id: folder.parent_folder_id,
        created_at: folder.created_at,
        is_public: folder.is_public,
    public_slug: folder.public_slug,
        subfolders,
        files: files.map(f => ({
            id: f.id,
            original_name: f.original_name,
            size: f.size,
            mime_type: f.mime_type,
            created_at: f.created_at
        })),
        file_count: files.length,
        subfolder_count: subfolders.length
    };
}
