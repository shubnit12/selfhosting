import rateLimit from 'express-rate-limit';
import { RATE_LIMITS as RATE_LIMIT_CONFIG } from '../config/constants';
import logger from '../utils/logger';

// ========================================
// AUTH ENDPOINTS RATE LIMITER (Strict)
// ========================================

/**
 * Rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
console.log("RATE_LIMIT_CONFIG.AUTH_MAX_REQUESTS : " , RATE_LIMIT_CONFIG.AUTH_MAX_REQUESTS)
export const authRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.AUTH_WINDOW_MS,
    max: RATE_LIMIT_CONFIG.AUTH_MAX_REQUESTS,
    message: {
        error: 'Too many requests',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,  // Return rate limit info in headers
    legacyHeaders: false,   // Disable X-RateLimit-* headers
    handler: (req, res) => {
        logger.warn('Rate limit exceeded for auth endpoint', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });

        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many authentication attempts. Please try again in 15 minutes.'
        });
    }
});

// ========================================
// FILE UPLOAD RATE LIMITER
// ========================================

/**
 * Rate limiter for file upload endpoints
 * 100 requests per hour per user
 */
export const uploadRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.UPLOAD_WINDOW_MS,
    max: RATE_LIMIT_CONFIG.UPLOAD_MAX_REQUESTS,
    skip: (req) => !req.user,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Upload rate limit exceeded', {
            userId: req.user?.userId,
            ip: req.ip
        });

        res.status(429).json({
            error: 'Upload limit exceeded',
            message: 'You have exceeded the upload limit. Please try again in 1 hour.'
        });
    }
});

// ========================================
// FILE DOWNLOAD RATE LIMITER
// ========================================

/**
 * Rate limiter for file download endpoints
 * 500 requests per hour per user
 */
export const downloadRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.DOWNLOAD_WINDOW_MS,
    max: RATE_LIMIT_CONFIG.DOWNLOAD_MAX_REQUESTS,
    skip: (req) => !req.user,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Download rate limit exceeded', {
            userId: req.user?.userId,
            ip: req.ip
        });

        res.status(429).json({
            error: 'Download limit exceeded',
            message: 'You have exceeded the download limit. Please try again in 1 hour.'
        });
    }
});

// ========================================
// GENERAL API RATE LIMITER
// ========================================

/**
 * General rate limiter for all API endpoints
 * 1000 requests per 15 minutes per user
 */
export const generalRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
    max: RATE_LIMIT_CONFIG.MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('General rate limit exceeded', {
            userId: req.user?.userId,
            ip: req.ip,
            path: req.path
        });

        res.status(429).json({
            error: 'Too many requests',
            message: 'You have made too many requests. Please try again in 15 minutes.'
        });
    }
});