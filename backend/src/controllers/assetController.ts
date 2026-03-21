import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ASSETS_PATH, ASSET_MAX_FILE_SIZE } from '../config/constants';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export async function uploadAsset(req: Request, res: Response) {
    if (!req.file) {
        throw new AppError('No file provided', 400);
    }

    if (req.file.size > ASSET_MAX_FILE_SIZE) {
        throw new AppError(`File too large. Maximum size is ${ASSET_MAX_FILE_SIZE} bytes`, 413);
    }

    // Ensure storage/assets/ folder exists (creates it if missing)
    fs.mkdirSync(ASSETS_PATH, { recursive: true });

    // Build filename — if file with same name exists, append timestamp
    const ext = path.extname(req.file.originalname);
    const base = path.basename(req.file.originalname, ext);
    const timestamp = Date.now();
    let filename = req.file.originalname;

    if (fs.existsSync(path.join(ASSETS_PATH, filename))) {
        filename = `${base}-${timestamp}${ext}`;
    }

    const destPath = path.join(ASSETS_PATH, filename);

    // Write file buffer to disk
    fs.writeFileSync(destPath, req.file.buffer);

    // Build public URL using request origin
    const origin = `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/api/v1/assets/${filename}`;

    logger.info('Asset uploaded', { filename, size: req.file.size, mimeType: req.file.mimetype });

    res.json({
        url,
        filename,
        size: req.file.size,
        mimeType: req.file.mimetype
    });
}

export async function serveAsset(req: Request, res: Response) {
    const filename = req.params.filename as string;

    // Prevent path traversal attacks (e.g. ../../etc/passwd)
    if (filename.includes('..') || filename.includes('/')) {
        throw new AppError('Invalid filename', 400);
    }

    const filePath = path.join(ASSETS_PATH, filename);

    if (!fs.existsSync(filePath)) {
        throw new AppError('Asset not found', 404);
    }

    res.sendFile(path.resolve(filePath));
}
