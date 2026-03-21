import { Request, Response, NextFunction } from 'express';
import { ASSET_API_KEY } from '../config/constants';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
    const key = req.headers['x-api-key'];

    if (!ASSET_API_KEY) {
        return res.status(500).json({ error: 'Asset API key not configured on server' });
    }

    if (!key || key !== ASSET_API_KEY) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    next();
}
