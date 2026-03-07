import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Middleware to restrict access to admin users only
 * Must be used AFTER authenticateToken middleware
 */
export function adminOnly(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    try {
        // Check if user is authenticated
        if (!req.user) {
            logger.warn('Admin-only route accessed without authentication');
            res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to access this resource'
            });
            return;
        }

        // Check if user is admin
        if (req.user.role !== 'admin') {
            logger.warn('Non-admin user attempted admin action', {
                userId: req.user.userId,
                username: req.user.username,
                role: req.user.role
            });

            res.status(403).json({
                error: 'Forbidden',
                message: 'Admin privileges required'
            });
            return;
        }

        // User is admin - continue
        logger.debug('Admin access granted', {
            userId: req.user.userId,
            username: req.user.username
        });

        next();

    } catch (error) {
        logger.error('Admin check failed', {
            error: (error as Error).message
        });

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to verify admin status'
        });
    }
}