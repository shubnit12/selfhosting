import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isTokenBlacklisted } from '../services/authService';
import logger from '../utils/logger';
import multer from 'multer';
// ========================================
// EXTEND EXPRESS REQUEST TYPE
// ========================================

// Add user property to Request
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                username: string;
                email: string;
                role: 'admin' | 'user';
            };
            file?: Multer.File;
        }
    }
}

// ========================================
// AUTH MIDDLEWARE
// ========================================

/**
 * Verify JWT token and attach user to request
 */
export async function authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // 1. Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ 
                error: 'No token provided',
                message: 'Authorization header missing or invalid format'
            });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // 2. Check if token is blacklisted (logged out)
        const blacklisted = await isTokenBlacklisted(token);
        
        if (blacklisted) {
            logger.warn('Blacklisted token attempted', { 
                token: token.substring(0, 20) + '...',
                ip: req.ip 
            });
            
            res.status(401).json({ 
                error: 'Token has been revoked',
                message: 'Please log in again'
            });
            return;
        }

        // 3. Verify token
        const payload = verifyAccessToken(token);

        // 4. Attach user to request
        req.user = {
            userId: payload.userId,
            username: payload.username,
            email: payload.email,
            role: payload.role,
        };

        logger.debug('User authenticated', { 
            userId: req.user.userId,
            username: req.user.username 
        });

        // 5. Continue to next middleware/controller
        next();

    } catch (error) {
        logger.warn('Authentication failed', { 
            error: (error as Error).message,
            ip: req.ip 
        });
        
        res.status(401).json({ 
            error: 'Authentication failed',
            message: (error as Error).message
        });
    }
}

/**
 * Optional authentication (doesn't fail if no token)
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            // Check blacklist
            const blacklisted = await isTokenBlacklisted(token);
            if (!blacklisted) {
                // Verify and attach user
                const payload = verifyAccessToken(token);
                req.user = {
                    userId: payload.userId,
                    username: payload.username,
                    email: payload.email,
                    role: payload.role,
                };
            }
        }
        
        // Continue regardless of auth status
        next();
    } catch (error) {
        // Don't fail, just continue without user
        next();
    }
}