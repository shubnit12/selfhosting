import fs from 'fs';
import path from 'path';
import { getFilePath } from './storageService';
import { deleteFile } from './storageService';
import redis from '../config/redis';
import logger from '../utils/logger';
import { FileReference, File, Folder, User } from '../models';
import { Op } from 'sequelize';

const THUMBNAIL_DIR = process.env.THUMBNAIL_PATH || './storage/thumbnails';
const TEMP_DIR = process.env.TEMP_PATH || './storage/temp';

/**
 * Cleanup orphaned file references (reference_count = 0)
 * These are files on disk with no File records pointing to them
 */
export async function cleanupOrphanedReferences(): Promise<{
    filesDeleted: number;
    storageFreed: number;
}> {
    try {
        let filesDeleted = 0;
        let storageFreed = 0;

        // Find all file references with zero references
        const orphanedRefs = await FileReference.findAll({
            where: { reference_count: 0 }
        });

        logger.info('Found orphaned file references', {
            count: orphanedRefs.length
        });

        for (const ref of orphanedRefs) {
            try {
                // Delete physical file
                const filePath = getFilePath(ref.file_hash, path.extname(ref.stored_path));
                
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    await deleteFile(filePath);
                    storageFreed += stats.size;
                }

                // Delete reference record
                await ref.destroy();
                filesDeleted++;

                logger.debug('Orphaned file deleted', {
                    fileHash: ref.file_hash.substring(0, 16) + '...',
                    storagePath: ref.stored_path
                });
            } catch (error) {
                logger.error('Failed to delete orphaned file', {
                    error: (error as Error).message,
                    fileHash: ref.file_hash
                });
            }
        }

        logger.info('Orphaned file references cleanup completed', {
            filesDeleted,
            storageFreed
        });

        return { filesDeleted, storageFreed };
    } catch (error) {
        logger.error('Orphaned references cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Cleanup expired upload sessions (older than 7 days)
 * Removes temp chunks and Redis entries
 */
export async function cleanupExpiredSessions(): Promise<{
    sessionsDeleted: number;
    chunksDeleted: number;
}> {
    try {
        let sessionsDeleted = 0;
        let chunksDeleted = 0;

        // Get all upload session keys from Redis
        const keys = await redis.keys('upload_session:*');

        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        for (const key of keys) {
            try {
                const sessionData = await redis.get(key);
                if (!sessionData) continue;

                const session = JSON.parse(sessionData);
                const createdAt = new Date(session.created_at).getTime();

                // Check if session is older than 7 days
                if (createdAt < sevenDaysAgo) {
                    const sessionId = key.replace('upload_session:', '');

                    // Delete temp directory with chunks
                    const tempDir = path.join(TEMP_DIR, sessionId);
                    if (fs.existsSync(tempDir)) {
                        const files = fs.readdirSync(tempDir);
                        chunksDeleted += files.length;
                        fs.rmSync(tempDir, { recursive: true, force: true });
                    }

                    // Delete Redis key
                    await redis.del(key);
                    sessionsDeleted++;

                    logger.debug('Expired upload session deleted', {
                        sessionId,
                        age: Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000)) + ' days'
                    });
                }
            } catch (error) {
                logger.error('Failed to cleanup session', {
                    error: (error as Error).message,
                    key
                });
            }
        }

        logger.info('Expired sessions cleanup completed', {
            sessionsDeleted,
            chunksDeleted
        });

        return { sessionsDeleted, chunksDeleted };
    } catch (error) {
        logger.error('Expired sessions cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Cleanup orphaned thumbnails (thumbnail exists but file deleted)
 */
export async function cleanupOrphanedThumbnails(): Promise<{
    thumbnailsDeleted: number;
}> {
    try {
        let thumbnailsDeleted = 0;

        if (!fs.existsSync(THUMBNAIL_DIR)) {
            return { thumbnailsDeleted: 0 };
        }

        // Get all thumbnail files
        const thumbnailFiles = fs.readdirSync(THUMBNAIL_DIR);

        for (const thumbnailFile of thumbnailFiles) {
            try {
                // Extract file hash from thumbnail filename
                // Format: {hash}_thumb.jpg
                const fileHash = thumbnailFile.replace('_thumb.jpg', '');

                // Check if any File record references this hash
                const fileExists = await File.findOne({
                    where: { file_hash: fileHash }
                });

                if (!fileExists) {
                    // Orphaned thumbnail - delete it
                    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFile);
                    fs.unlinkSync(thumbnailPath);
                    thumbnailsDeleted++;

                    logger.debug('Orphaned thumbnail deleted', {
                        thumbnailFile,
                        fileHash: fileHash.substring(0, 16) + '...'
                    });
                }
            } catch (error) {
                logger.error('Failed to cleanup thumbnail', {
                    error: (error as Error).message,
                    thumbnailFile
                });
            }
        }

        logger.info('Orphaned thumbnails cleanup completed', {
            thumbnailsDeleted
        });

        return { thumbnailsDeleted };
    } catch (error) {
        logger.error('Orphaned thumbnails cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Run all cleanup tasks
 */
export async function runAllCleanupTasks(): Promise<{
    orphanedFiles: { filesDeleted: number; storageFreed: number };
    expiredSessions: { sessionsDeleted: number; chunksDeleted: number };
    orphanedThumbnails: { thumbnailsDeleted: number };
    unreferencedFiles: { filesDeleted: number; storageFreed: number };
     trashedFiles: { filesDeleted: number; storageFreed: number };
    trashedFolders: { foldersDeleted: number };
    inactiveUsers: { usersDeleted: number; filesDeleted: number; foldersDeleted: number; storageFreed: number };
    missingThumbnails: { jobsQueued: number };
}> {
    logger.info('Starting cleanup tasks...');

    const results = {
        orphanedFiles: await cleanupOrphanedReferences(),
        expiredSessions: await cleanupExpiredSessions(),
        orphanedThumbnails: await cleanupOrphanedThumbnails(),
        unreferencedFiles: await cleanupUnreferencedFiles(),
          trashedFiles: await cleanupTrashedFiles(),
        trashedFolders: await cleanupTrashedFolders(),
        inactiveUsers: await cleanupInactiveUsers(),
         missingThumbnails: await regenerateMissingThumbnails()
        
    };

    logger.info('All cleanup tasks completed', results);

    return results;
}


/**
 * Cleanup unreferenced physical files (files on disk with no database reference)
 * Scans storage directory and checks if file_reference exists
 */
export async function cleanupUnreferencedFiles(): Promise<{
    filesDeleted: number;
    storageFreed: number;
}> {
    try {
        let filesDeleted = 0;
        let storageFreed = 0;

        const FILES_DIR = process.env.STORAGE_PATH || './storage/files';

        if (!fs.existsSync(FILES_DIR)) {
            return { filesDeleted: 0, storageFreed: 0 };
        }

        // Recursively scan storage directory
        const scanDirectory = async (dir: string): Promise<void> => {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // Recursively scan subdirectories
                    await scanDirectory(fullPath);
                } else if (stat.isFile()) {
                    // Extract hash from filename
                    const filename = path.basename(fullPath, path.extname(fullPath));
                    
                    // Check if file_reference exists for this hash
                    const refExists = await FileReference.findOne({
                        where: { file_hash: filename }
                    });

                    if (!refExists) {
                        // Unreferenced file - delete it
                        try {
                            fs.unlinkSync(fullPath);
                            filesDeleted++;
                            storageFreed += stat.size;

                            logger.debug('Unreferenced file deleted', {
                                filePath: fullPath,
                                fileHash: filename.substring(0, 16) + '...',
                                size: stat.size
                            });
                        } catch (error) {
                            logger.error('Failed to delete unreferenced file', {
                                error: (error as Error).message,
                                filePath: fullPath
                            });
                        }
                    }
                }
            }
        };

        await scanDirectory(FILES_DIR);

        logger.info('Unreferenced files cleanup completed', {
            filesDeleted,
            storageFreed
        });

        return { filesDeleted, storageFreed };
    } catch (error) {
        logger.error('Unreferenced files cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Cleanup trashed files older than 30 days
 * Permanently deletes files that have been in trash for 30+ days
 */
export async function cleanupTrashedFiles(): Promise<{
    filesDeleted: number;
    storageFreed: number;
}> {
    try {
        let filesDeleted = 0;
        let storageFreed = 0;

        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        // Find files deleted more than 30 days ago
        const trashedFiles = await File.findAll({
            where: {
                is_deleted: true,
                deleted_at: {
                    [Op.lt]: thirtyDaysAgo
                }
            }
        });

        logger.info('Found trashed files to permanently delete', {
            count: trashedFiles.length
        });

        for (const file of trashedFiles) {
            try {
                // Get file reference
                const ref = await FileReference.findOne({
                    where: { file_hash: file.file_hash }
                });

                if (ref) {
                    if (ref.reference_count === 1) {
                        // Unique file - delete physical file
                        const filePath = getFilePath(ref.file_hash, path.extname(ref.stored_path));
                        
                        if (fs.existsSync(filePath)) {
                            await deleteFile(filePath);
                            storageFreed += Number(file.size);
                        }

                        // Delete file reference
                        await ref.destroy();
                    } else {
                        // Shared file - decrement reference
                        await ref.update({
                            reference_count: ref.reference_count - 1
                        });
                    }
                }

                // Delete file record
                await file.destroy();
                filesDeleted++;

                logger.debug('Trashed file permanently deleted', {
                    fileId: file.id,
                    filename: file.original_name,
                    deletedAt: file.deleted_at
                });
            } catch (error) {
                logger.error('Failed to delete trashed file', {
                    error: (error as Error).message,
                    fileId: file.id
                });
            }
        }

        logger.info('Trashed files cleanup completed', {
            filesDeleted,
            storageFreed
        });

        return { filesDeleted, storageFreed };
    } catch (error) {
        logger.error('Trashed files cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Cleanup trashed folders older than 30 days
 * Permanently deletes folders that have been in trash for 30+ days
 */
export async function cleanupTrashedFolders(): Promise<{
    foldersDeleted: number;
}> {
    try {
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        // Find folders deleted more than 30 days ago
        const trashedFolders = await Folder.findAll({
            where: {
                is_deleted: true,
                deleted_at: {
                    [Op.lt]: thirtyDaysAgo
                }
            }
        });

        logger.info('Found trashed folders to permanently delete', {
            count: trashedFolders.length
        });

        // Delete all trashed folders
        const foldersDeleted = await Folder.destroy({
            where: {
                is_deleted: true,
                deleted_at: {
                    [Op.lt]: thirtyDaysAgo
                }
            }
        });

        logger.info('Trashed folders cleanup completed', {
            foldersDeleted
        });

        return { foldersDeleted };
    } catch (error) {
        logger.error('Trashed folders cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * Cleanup inactive users older than 30 days
 * Permanently deletes users that have been inactive for 30+ days
 */
export async function cleanupInactiveUsers(): Promise<{
    usersDeleted: number;
    filesDeleted: number;
    foldersDeleted: number;
    storageFreed: number;
}> {
    try {
        let usersDeleted = 0;
        let totalFilesDeleted = 0;
        let totalFoldersDeleted = 0;
        let totalStorageFreed = 0;

        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        // Find inactive users deleted more than 30 days ago
        const inactiveUsers = await User.findAll({
            where: {
                is_active: false,
                deleted_at: {
                    [Op.lt]: thirtyDaysAgo
                }
            }
        });

        logger.info('Found inactive users to permanently delete', {
            count: inactiveUsers.length
        });

        for (const user of inactiveUsers) {
            try {
                // Use existing hardDeleteUser function
                const { hardDeleteUser } = await import('./userService');
                
                const stats = await hardDeleteUser(user.id, 'system');

                totalFilesDeleted += stats.filesDeleted;
                totalFoldersDeleted += stats.foldersDeleted;
                totalStorageFreed += stats.storageFreed;
                usersDeleted++;

                logger.info('Inactive user permanently deleted', {
                    userId: user.id,
                    username: user.username,
                    deletedAt: user.deleted_at,
                    stats
                });
            } catch (error) {
                logger.error('Failed to delete inactive user', {
                    error: (error as Error).message,
                    userId: user.id
                });
            }
        }

        logger.info('Inactive users cleanup completed', {
            usersDeleted,
            filesDeleted: totalFilesDeleted,
            foldersDeleted: totalFoldersDeleted,
            storageFreed: totalStorageFreed
        });

        return {
            usersDeleted,
            filesDeleted: totalFilesDeleted,
            foldersDeleted: totalFoldersDeleted,
            storageFreed: totalStorageFreed
        };
    } catch (error) {
        logger.error('Inactive users cleanup failed', {
            error: (error as Error).message
        });
        throw error;
    }
}


/**
 * Regenerate missing thumbnails
 * Finds image/video files without thumbnails and queues generation jobs
 */
export async function regenerateMissingThumbnails(): Promise<{
    jobsQueued: number;
}> {
    try {
        let jobsQueued = 0;

        // Find image/video files without thumbnails
        const filesWithoutThumbnails = await File.findAll({
            where: {
                thumbnail_path: null,
                is_deleted: false,
                is_available: true,
                mime_type: {
                    [Op.or]: [
                        { [Op.like]: 'image/%' },
                        { [Op.like]: 'video/%' }
                    ]
                }
            },
            limit: 100  // Process max 100 at a time to avoid overload
        });

        logger.info('Found files without thumbnails', {
            count: filesWithoutThumbnails.length
        });

        // Queue thumbnail jobs
        const { thumbnailQueue } = await import('../config/queue');
        const { getFilePath } = await import('./storageService');

        for (const file of filesWithoutThumbnails) {
            try {
                // Get file reference to get stored_path
                const ref = await FileReference.findOne({
                    where: { file_hash: file.file_hash }
                });

                if (ref) {
                    await thumbnailQueue.add('generate-thumbnail', {
                        fileId: file.id,
                        filePath: getFilePath(ref.file_hash, path.extname(ref.stored_path)),
                        fileHash: ref.file_hash,
                        mimeType: file.mime_type
                    });

                    jobsQueued++;

                    logger.debug('Thumbnail job queued', {
                        fileId: file.id,
                        filename: file.original_name
                    });
                }
            } catch (error) {
                logger.error('Failed to queue thumbnail job', {
                    error: (error as Error).message,
                    fileId: file.id
                });
            }
        }

        logger.info('Missing thumbnails regeneration queued', {
            jobsQueued
        });

        return { jobsQueued };
    } catch (error) {
        logger.error('Regenerate thumbnails failed', {
            error: (error as Error).message
        });
        throw error;
    }
}