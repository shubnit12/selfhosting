import path from 'path';
import { FileReference, File, User } from '../models';
import logger from '../utils/logger';
import { Op } from 'sequelize';

// ========================================
// INTERFACES
// ========================================
 

interface DuplicateCheckResult {
    isDuplicate: boolean;
    fileReference?: FileReference;
    existingFile?: File;
}

interface LinkFileResult {
    file: File;
    wasInstant: boolean // true if linked to existing, false if new upload
}

// ========================================
// DUPLICATE DETECTION
// ========================================
 
/**
 * Check if file with given hash already exists
 * 
 * @param fileHash - SHA256 hash of file
 * @returns Duplicate check result
 */

export async function checkDuplicate(fileHash: string): Promise<DuplicateCheckResult> {
    try {
        // Check if file_hash exists in file_references table
        const fileReference = await FileReference.findOne({
            where: {file_hash: fileHash}
        })

        if(fileReference){
            logger.info('Duplicate file detected', {
                hash: fileHash.substring(0, 16) + '...',
                referenceCount: fileReference.reference_count
            });

            return {
                isDuplicate: true,
                fileReference
            };
        }

         logger.debug('File is unique (not a duplicate)', {
            hash: fileHash.substring(0, 16) + '...'
        });
 
        return {
            isDuplicate: false
        };


    } catch (error) {
         logger.error('Duplicate check failed', {
            error: (error as Error).message,
            hash: fileHash.substring(0, 16) + '...'
        });
        throw error;
    }
}


/**
 * Check if user already has this file
 * 
 * @param userId - User ID
 * @param fileHash - File hash
 * @returns true if user already has this file
 */

export async function userHasFile(userId: string, fileHash: string): Promise<boolean> {
    try {
    
        const existingFile = await File.findOne({
            where:{
                user_id: userId,
                file_hash: fileHash,
                is_deleted:false
            }
        })

        return existingFile !== null;
        
    } catch (error) {
          logger.error('User file check failed', {
            error: (error as Error).message,
            userId,
            hash: fileHash.substring(0, 16) + '...'
        });
        throw error;
    }
}

// ========================================
// LINK TO EXISTING FILE
// ========================================
 
/**
 * Link user to existing file (instant upload via deduplication)
 * Creates file record for user pointing to existing physical file
 * 
 * @param userId - User ID
 * @param fileHash - File hash
 * @param originalName - User's filename
 * @param folderId - Folder ID (optional)
 * @param mimeType - MIME type
 * @param fileSize - File size in bytes
 * @returns Created file record
 */


export async function linkToExistingFile (
    userId: string,
    fileHash: string,
    originalName: string,
    folderId: string | null,
    mimeType: string,
    fileSize: number
) : Promise <File>{
    try {
        // Get file reference
        const fileReference = await FileReference.findOne({
            where: { file_hash: fileHash }
        });

        if (!fileReference) {
            throw new Error('File reference not found');
        }

        await fileReference.increment('reference_count');
        await fileReference.reload();

        logger.info('Reference count incremented', {
            hash: fileHash.substring(0, 16) + '...',
            newCount: fileReference.reference_count
        });

        const existingFileWithThumbnail = await File.findOne({
    where: { 
        file_hash: fileHash,
        thumbnail_path: { [Op.ne]: null }
    }
});
        const file = await File.create({
            user_id: userId,
            folder_id: folderId,
            original_name: originalName,
            stored_name: path.basename(fileReference.stored_path),
            file_path: fileReference.stored_path,
            file_hash: fileHash,
            mime_type: mimeType,
            size: fileSize,
            upload_status: 'completed',
            is_available: true,
            thumbnail_path: existingFileWithThumbnail?.thumbnail_path || null  // Copy thumbnail if exists


        })

        logger.info('File linked to existing physical file', {
            fileId: file.id,
            userId,
            hash: fileHash.substring(0, 16) + '...',
            savedStorage: `${(fileSize / 1024 / 1024).toFixed(2)}MB`
        });
        
        return file;

    } catch (error) {
        logger.error('Failed to link to existing file', {
            error: (error as Error).message,
            userId,
            hash: fileHash.substring(0, 16) + '...'
        });
        throw error;
    }
}

// ========================================
// DECREMENT REFERENCE (On Delete)
// ========================================
 
/**
 * Decrement reference count when file is deleted
 * Returns true if physical file should be deleted (count reached 0)
 * 
 * @param fileHash - File hash
 * @returns true if physical file should be deleted
 */

export async function decrementReference (fileHash: string): Promise<boolean> {

    try {
        const fileReference = await FileReference.findOne({
            where:{file_hash: fileHash}
        })
         if (!fileReference) {
            logger.warn('File reference not found for decrement', {
                hash: fileHash.substring(0, 16) + '...'
            });
            return false;
        }

        // Decrement count
        await fileReference.decrement('reference_count');
        await fileReference.reload();

        logger.info('Reference count decremented', {
            hash: fileHash.substring(0, 16) + '...',
            newCount: fileReference.reference_count
        });


        // If count reaches 0, delete physical file
        if (fileReference.reference_count === 0) {
            await fileReference.destroy();
            
            logger.info('No more references - physical file should be deleted', {
                hash: fileHash.substring(0, 16) + '...',
                path: fileReference.stored_path
            });
            
            return true;  // Signal to delete physical file
        }

          return false;  // Keep physical file


    } catch (error) {
        logger.error('Failed to decrement reference', {
            error: (error as Error).message,
            hash: fileHash.substring(0, 16) + '...'
        });
        throw error;
  
    }
}


// ========================================
// CREATE FILE REFERENCE
// ========================================
 
/**
 * Create new file reference entry (for new unique files)
 * 
 * @param fileHash - SHA256 hash
 * @param storedPath - Physical file path on disk
 * @returns Created FileReference
 */
export async function createFileReference(
    fileHash: string,
    storedPath: string
): Promise<FileReference> {
    try {
        const fileReference = await FileReference.create({
            file_hash: fileHash,
            stored_path: storedPath,
            reference_count: 1
        });
 
        logger.info('File reference created', {
            hash: fileHash.substring(0, 16) + '...',
            path: storedPath
        });
 
        return fileReference;
 
    } catch (error) {
        logger.error('Failed to create file reference', {
            error: (error as Error).message,
            hash: fileHash.substring(0, 16) + '...'
        });
        throw error;
    }
}