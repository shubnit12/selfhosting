import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

const execAsync = promisify(exec);

// Thumbnail directory
const THUMBNAIL_DIR = process.env.THUMBNAIL_PATH || './storage/thumbnails';

// Ensure thumbnail directory exists
if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

/**
 * Generate thumbnail for image file
 * 
 * @param inputPath - Path to original image
 * @param outputPath - Path to save thumbnail
 * @returns Path to generated thumbnail
 */
export async function generateImageThumbnail(
    inputPath: string,
    outputPath: string
): Promise<string> {
    try {
        await sharp(inputPath)
            .resize(200, 200, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(outputPath);

        logger.info('Image thumbnail generated', {
            inputPath,
            outputPath
        });

        return outputPath;
    } catch (error) {
        logger.error('Failed to generate image thumbnail', {
            error: (error as Error).message,
            inputPath
        });
        throw error;
    }
}

/**
 * Generate thumbnail for video file using FFmpeg
 * Extracts frame at 1 second
 * 
 * @param inputPath - Path to original video
 * @param outputPath - Path to save thumbnail
 * @returns Path to generated thumbnail
 */
export async function generateVideoThumbnail(
    inputPath: string,
    outputPath: string
): Promise<string> {
    try {
        // Try to extract frame at 1 second first
        const command = `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 -vf "scale=200:200:force_original_aspect_ratio=decrease" "${outputPath}" -y`;

        try {
            await execAsync(command);
            logger.info('Video thumbnail generated at 1 second', {
                inputPath,
                outputPath
            });
            return outputPath;
        } catch (firstError) {
            // If extracting at 1 second fails, try the very first frame
            logger.warn('Failed to extract frame at 1 second, trying first frame', {
                error: (firstError as Error).message,
                inputPath
            });

            const fallbackCommand = `ffmpeg -i "${inputPath}" -vframes 1 -vf "scale=200:200:force_original_aspect_ratio=decrease" "${outputPath}" -y`;
            await execAsync(fallbackCommand);

            logger.info('Video thumbnail generated from first frame', {
                inputPath,
                outputPath
            });
            return outputPath;
        }
    } catch (error) {
        logger.error('Failed to generate video thumbnail', {
            error: (error as Error).message,
            inputPath
        });
        throw error;
    }
}

/**
 * Generate thumbnail based on file type
 * 
 * @param filePath - Path to original file
 * @param fileHash - File hash (for thumbnail naming)
 * @param mimeType - MIME type of file
 * @returns Path to generated thumbnail or null if not supported
 */
export async function generateThumbnail(
    filePath: string,
    fileHash: string,
    mimeType: string
): Promise<string | null> {
    try {
        const thumbnailPath = path.join(THUMBNAIL_DIR, `${fileHash}_thumb.jpg`);

        // Check if thumbnail already exists
        if (fs.existsSync(thumbnailPath)) {
            logger.debug('Thumbnail already exists', { thumbnailPath });
            return thumbnailPath;
        }

        // Determine file type and generate appropriate thumbnail
        if (mimeType.startsWith('image/')) {
            return await generateImageThumbnail(filePath, thumbnailPath);
        } else if (mimeType.startsWith('video/')) {
            return await generateVideoThumbnail(filePath, thumbnailPath);
        } else {
            // Not an image or video - no thumbnail
            logger.debug('File type not supported for thumbnails', { mimeType });
            return null;
        }
    } catch (error) {
        logger.error('Thumbnail generation failed', {
            error: (error as Error).message,
            fileHash,
            mimeType
        });
        return null;
    }
}

/**
 * Get thumbnail path for a file hash
 */
export function getThumbnailPath(fileHash: string): string {
    return path.join(THUMBNAIL_DIR, `${fileHash}_thumb.jpg`);
}