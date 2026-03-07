import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ========================================
// CUSTOM ERROR CLASS
// ========================================

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;  // Operational errors vs programming errors
        Error.captureStackTrace(this, this.constructor);
    }
}

// ========================================
// ERROR HANDLER MIDDLEWARE
// ========================================

/**
 * Global error handler
 * Must be the LAST middleware in the chain
 */
export function errorHandler(
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Log error
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
        ip: req.ip
    });

    // Determine status code
    const statusCode = (err as AppError).statusCode || 500;

    // Determine if operational error
    const isOperational = (err as AppError).isOperational || false;

    // Development vs Production error response
    if (process.env.NODE_ENV === 'development') {
        // Development: Send full error details
        res.status(statusCode).json({
            error: err.message,
            stack: err.stack,
            path: req.path,
            timestamp: new Date().toISOString()
        });
    } else {
        // Production: Send minimal error info
        if (isOperational) {
            // Operational error (safe to expose)
            res.status(statusCode).json({
                error: err.message,
                message: 'An error occurred while processing your request'
            });
        } else {
            // Programming error (don't expose details)
            res.status(500).json({
                error: 'Internal server error',
                message: 'Something went wrong. Please try again later.'
            });
        }
    }
}

// ========================================
// 404 NOT FOUND HANDLER
// ========================================

/**
 * Handle 404 errors (route not found)
 */
export function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    logger.warn('Route not found', {
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
}