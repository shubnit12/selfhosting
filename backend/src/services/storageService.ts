import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

// ========================================
// STORAGE PATHS
// ========================================
 
const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
const FILES_DIR = path.join(STORAGE_ROOT, 'files');
const THUMBNAILS_DIR = path.join(STORAGE_ROOT, 'thumbnails');
const TEMP_DIR = path.join(STORAGE_ROOT, 'temp');

// ========================================
// PATH GENERATION
// ========================================
 
/**
 * Generate hash-based storage path for a file
 * Uses first 4 characters of hash for 2-level directory structure
 * 
 * Example: hash "abcdef123..." → "/ab/cd/abcdef123...xyz.jpg"
 * 
 * @param fileHash - SHA256 hash (64 characters)
 * @param extension - File extension (e.g., '.jpg')
 * @returns Relative path from storage root
 */

export function generateStoragePath(fileHash: string, extension: string):string{
    
    // Use first 2 chars for level-1 directory
    const level1 = fileHash.substring(0,2);

    // Use next 2 chars for level-2 directory
    const level2 = fileHash.substring(2, 4);
    
    // Filename is full hash + extension
    const filename = `${fileHash}${extension}`;

    // Relative path: /ab/cd/abcdef123...xyz.jpg
    const relativePath = path.join(level1, level2, filename);

    logger.debug('Storage path generated', {
        hash: fileHash.substring(0, 16) + '...',
        path: relativePath
    });
    
    return relativePath;
}

/**
 * Get absolute file path in storage
 * 
 * @param fileHash - SHA256 hash
 * @param extension - File extension
 * @returns Absolute path on disk
 */

export function getFilePath(fileHash: string, extension: string): string {
    const relativePath = generateStoragePath(fileHash, extension);
    return path.join(FILES_DIR, relativePath);
}
 
/**
 * Get absolute thumbnail path
 * 
 * @param fileHash - SHA256 hash
 * @param extension - Thumbnail extension (usually '.jpg' or '.gif')
 * @returns Absolute path on disk
 */
export function getThumbnailPath(fileHash: string, extension: string = '.jpg'): string {
    const level1 = fileHash.substring(0, 2);
    const level2 = fileHash.substring(2, 4);
    const filename = `${fileHash}_thumb${extension}`;
    
    return path.join(THUMBNAILS_DIR, level1, level2, filename);
}
 
/**
 * Get temp directory path for upload session
 * 
 * @param sessionId - Upload session UUID
 * @returns Absolute path to temp directory
 */
export function getTempUploadPath(sessionId: string): string {
    return path.join(TEMP_DIR, sessionId);
}

/**
 * Get chunk file path
 * 
 * @param sessionId - Upload session UUID
 * @param chunkIndex - Chunk number
 * @returns Absolute path to chunk file
 */
export function getChunkPath(sessionId: string, chunkIndex: number): string {
    return path.join(TEMP_DIR, sessionId, `chunk_${chunkIndex}`);
}

// ========================================
// DIRECTORY MANAGEMENT
// ========================================
 
/**
 * Ensure directory exists, create if not
 * Creates parent directories recursively
 * 
 * @param dirPath - Directory path
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
        logger.debug('Directory ensured', { dirPath });
    } catch (error) {
        logger.error('Failed to create directory', {
            error: (error as Error).message,
            dirPath
        });
        throw error;
    }
}
 
/**
 * Ensure storage directory structure exists
 * Creates files/, thumbnails/, temp/ directories
 */
export async function initializeStorage(): Promise<void> {
    try {
        await ensureDirectoryExists(FILES_DIR);
        await ensureDirectoryExists(THUMBNAILS_DIR);
        await ensureDirectoryExists(TEMP_DIR);
        
        logger.info('Storage initialized', {
            root: STORAGE_ROOT,
            files: FILES_DIR,
            thumbnails: THUMBNAILS_DIR,
            temp: TEMP_DIR
        });
    } catch (error) {
        logger.error('Storage initialization failed', {
            error: (error as Error).message
        });
        throw error;
    }
}
 
/**
 * Ensure file's parent directory exists
 * 
 * @param filePath - Full file path
 */
export async function ensureFileDirectory(filePath: string): Promise<void> {
    const dirPath = path.dirname(filePath);
    await ensureDirectoryExists(dirPath);
}

// ========================================
// FILE OPERATIONS
// ========================================
 
/**
 * Move file from source to destination
 * Creates destination directory if needed
 * 
 * @param sourcePath - Source file path
 * @param destPath - Destination file path
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
    try {
        // Ensure destination directory exists
        await ensureFileDirectory(destPath);
        
        // Move file
        await fs.promises.rename(sourcePath, destPath);
        
        logger.debug('File moved', {
            from: sourcePath,
            to: destPath
        });
    } catch (error) {
        logger.error('Failed to move file', {
            error: (error as Error).message,
            from: sourcePath,
            to: destPath
        });
        throw error;
    }
}

/**
 * Delete file from disk
 * 
 * @param filePath - File path to delete
 */
export async function deleteFile(filePath: string): Promise<void> {
    try {
        await fs.promises.unlink(filePath);
        logger.debug('File deleted', { filePath });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // File doesn't exist - not an error
            logger.debug('File already deleted', { filePath });
        } else {
            logger.error('Failed to delete file', {
                error: (error as Error).message,
                filePath
            });
            throw error;
        }
    }
}
 

/**
 * Delete directory recursively
 * 
 * @param dirPath - Directory path to delete
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
    try {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
        logger.debug('Directory deleted', { dirPath });
    } catch (error) {
        logger.error('Failed to delete directory', {
            error: (error as Error).message,
            dirPath
        });
        throw error;
    }
}

/**
 * Check if file exists
 * 
 * @param filePath - File path to check
 * @returns true if exists, false otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get file size
 * 
 * @param filePath - File path
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
    try {
        const stats = await fs.promises.stat(filePath);
        return stats.size;
    } catch (error) {
        logger.error('Failed to get file size', {
            error: (error as Error).message,
            filePath
        });
        throw error;
    }
}
 

// ========================================
// EXPORTS
// ========================================
 
export const storagePaths = {
    root: STORAGE_ROOT,
    files: FILES_DIR,
    thumbnails: THUMBNAILS_DIR,
    temp: TEMP_DIR
};