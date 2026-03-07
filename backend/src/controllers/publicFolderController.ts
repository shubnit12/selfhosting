import { Request, Response } from 'express';
import { getPublicFolders, getPublicFolderBySlug } from '../services/folderService';
import { File } from '../models';
import { getFilePath } from '../services/storageService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/v1/public/folders
 * List all public folders (no auth required)
 */
export async function listPublicFolders(req: Request, res: Response): Promise<void> {
    try {
        const folders = await getPublicFolders();

        res.json({
            folders
        });
    } catch (error) {
        logger.error('List public folders failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

/**
 * GET /api/v1/public/folders/:slug
 * Get public folder contents (no auth required)
 */
export async function getPublicFolder(req: Request, res: Response): Promise<void> {
    try {
        const slug = req.params.slug as string;
        const result = await getPublicFolderBySlug(slug);

        res.json(result);
    } catch (error) {
        logger.error('Get public folder failed', {
            error: (error as Error).message,
            slug: req.params.slug
        });
        throw error;
    }
}

/**
 * GET /api/v1/public/folders/:slug/files/:fileId/download
 * Download file from public folder (no auth required)
 */
export async function downloadPublicFile(req: Request, res: Response): Promise<void> {
    try {
        const slug = req.params.slug as string;
        const fileId = req.params.fileId as string;

        // Verify folder is public
        const folderData = await getPublicFolderBySlug(slug);

        // Get file
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify file is in this public folder
        if (file.folder_id !== folderData.folder.id) {
            throw new AppError('File not in this folder', 403);
        }

        // Verify file is not deleted
        if (file.is_deleted || !file.is_available) {
            throw new AppError('File not available', 404);
        }

        // Get file path
        const filePath = getFilePath(file.file_hash, path.extname(file.file_path));

        if (!fs.existsSync(filePath)) {
            throw new AppError('File not found on disk', 404);
        }

        // Set headers
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Length', file.size.toString());

        // Stream file
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.error('Public file stream error', {
                error: error.message,
                fileId
            });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

        logger.info('Public file downloaded', {
            fileId,
            filename: file.original_name,
            slug
        });

    } catch (error) {
        logger.error('Download public file failed', {
            error: (error as Error).message,
            slug: req.params.slug,
            fileId: req.params.fileId
        });
        throw error;
    }
}
/**
 * GET /api/v1/public/folders/:slug/files/:fileId/thumbnail
 * Get thumbnail from public folder (no auth required)
 */
export async function getPublicThumbnail(req: Request, res: Response): Promise<void> {
    try {
        const slug = req.params.slug as string;
        const fileId = req.params.fileId as string;

        // Verify folder is public
        const folderData = await getPublicFolderBySlug(slug);

        // Get file
        const file = await File.findByPk(fileId);

        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Verify file is in this public folder
        if (file.folder_id !== folderData.folder.id) {
            throw new AppError('File not in this folder', 403);
        }

        // Check if thumbnail exists
        if (!file.thumbnail_path || !fs.existsSync(file.thumbnail_path)) {
            throw new AppError('Thumbnail not available', 404);
        }

        // Stream thumbnail
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        const stream = fs.createReadStream(file.thumbnail_path);
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.error('Public thumbnail stream error', {
                error: error.message,
                fileId
            });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream thumbnail' });
            }
        });

    } catch (error) {
        logger.error('Get public thumbnail failed', {
            error: (error as Error).message,
            slug: req.params.slug,
            fileId: req.params.fileId
        });
        throw error;
    }
}