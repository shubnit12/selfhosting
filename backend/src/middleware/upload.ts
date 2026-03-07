import multer from 'multer';
import { AppError } from './errorHandler';

// ========================================
// MULTER CONFIGURATION
// ========================================

/**
 * Multer configuration for chunk uploads
 * Stores chunks in memory (as Buffer) for processing
 */
const storage = multer.memoryStorage();

/**
 * File filter - accept all file types
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept all files (no filtering)
    cb(null, true);
};

/**
 * Multer instance for chunk uploads
 * Max chunk size: 110MB (slightly larger than 100MB for safety)
 */
export const uploadChunk = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 110 * 1024 * 1024, // 110MB
        files: 1  // Only 1 file per request
    }
}).single('chunk');  // Field name is 'chunk'

/**
 * Multer instance for small file uploads
 * Max file size: 100MB
 */
export const uploadSingleFile = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 1
    }
}).single('file');  // Field name is 'file'

/**
 * Error handler for Multer errors
 */
export function handleMulterError(err: any, req: any, res: any, next: any) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            throw new AppError('File too large. Maximum chunk size is 110MB', 413);
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            throw new AppError('Too many files. Upload one file at a time', 400);
        }
        throw new AppError(`Upload error: ${err.message}`, 400);
    }
    next(err);
}