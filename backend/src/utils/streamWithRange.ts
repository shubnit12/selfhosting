import fs from 'fs';
import { Request, Response } from 'express';

export function streamWithRange(
    req: Request,
    res: Response,
    filePath: string,
    mimeType: string,
    fileSize: number,
    filename: string
): void {
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);

    if (!range) {
        res.setHeader('Content-Length', fileSize);
        res.status(200);
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024 - 1, fileSize - 1);

    if (start >= fileSize || end >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.status(416).end();
        return;
    }

    const chunkSize = end - start + 1;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.status(206);

    fs.createReadStream(filePath, { start, end }).pipe(res);
}
