import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BCRYPT_CONFIG, JWT_CONFIG } from '../config/constants';
import { tokenBlacklist } from '../config/redis';
import logger from '../utils/logger';

// ========================================
// INTERFACES
// ========================================

interface JWTPayload {
    userId: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

// ========================================
// PASSWORD HASHING
// ========================================

/**
 * Hash password using bcrypt (12 salt rounds)
 */
export async function hashPassword(password: string): Promise<string> {
    const hash = await bcrypt.hash(password, BCRYPT_CONFIG.SALT_ROUNDS);
    logger.debug('Password hashed successfully');
    return hash;
}

/**
 * Compare plain password with hashed password
 */
export async function comparePassword(
    plainPassword: string,
    hashedPassword: string
): Promise<boolean> {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    logger.debug('Password comparison result:', { isMatch });
    return isMatch;
}

// ========================================
// JWT TOKEN GENERATION
// ========================================

/**
 * Generate access token (15 minutes)
 */
export function generateAccessToken(payload: JWTPayload): string {
    const token = jwt.sign(payload, JWT_CONFIG.SECRET, {
        expiresIn: JWT_CONFIG.EXPIRES_IN as string,
    });
    
    logger.debug('Access token generated', { userId: payload.userId });
    return token;
}

/**
 * Generate refresh token (7 days)
 */
export function generateRefreshToken(payload: JWTPayload): string {
    const token = jwt.sign(payload, JWT_CONFIG.REFRESH_SECRET, {
        expiresIn: JWT_CONFIG.REFRESH_EXPIRES_IN as string,
    });
    
    logger.debug('Refresh token generated', { userId: payload.userId });
    return token;
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JWTPayload): TokenPair {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
    };
}

// ========================================
// JWT TOKEN VERIFICATION
// ========================================

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload {
    try {
        const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as JWTPayload;
        logger.debug('Access token verified', { userId: decoded.userId });
        return decoded;
    } catch (error) {
        logger.warn('Access token verification failed', { error: (error as Error).message });
        throw new Error('Invalid or expired token');
    }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
    try {
        const decoded = jwt.verify(token, JWT_CONFIG.REFRESH_SECRET) as JWTPayload;
        logger.debug('Refresh token verified', { userId: decoded.userId });
        return decoded;
    } catch (error) {
        logger.warn('Refresh token verification failed', { error: (error as Error).message });
        throw new Error('Invalid or expired refresh token');
    }
}

// ========================================
// TOKEN BLACKLIST (Redis)
// ========================================

/**
 * Blacklist a token (for logout)
 */
export async function blacklistToken(token: string): Promise<void> {
    try {
        // Decode token to get expiry time (without verifying)
        const decoded = jwt.decode(token) as any;
        
        if (!decoded || !decoded.exp) {
            throw new Error('Invalid token format');
        }
        
        // Calculate remaining TTL (time to live)
        const now = Math.floor(Date.now() / 1000);
        const ttl = decoded.exp - now;
        
        if (ttl > 0) {
            // Add to blacklist with TTL
            await tokenBlacklist.add(token, ttl);
            logger.info('Token blacklisted', { ttl });
        }
    } catch (error) {
        logger.error('Failed to blacklist token', { error: (error as Error).message });
        throw error;
    }
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklisted = await tokenBlacklist.isBlacklisted(token);
    
    if (blacklisted) {
        logger.warn('Blacklisted token used', { token: token.substring(0, 20) + '...' });
    }
    
    return blacklisted;
}

// ========================================
// REFRESH TOKEN ROTATION
// ========================================

/**
 * Refresh tokens with rotation (invalidate old refresh token)
 */
export async function refreshTokens(oldRefreshToken: string): Promise<TokenPair> {
    try {
        // 1. Verify old refresh token
        const payload = verifyRefreshToken(oldRefreshToken);
        
        // 2. Check if blacklisted
        const blacklisted = await isTokenBlacklisted(oldRefreshToken);
        if (blacklisted) {
            throw new Error('Refresh token has been revoked');
        }
        
        // 3. Generate new token pair
        const newTokens = generateTokenPair({
            userId: payload.userId,
            username: payload.username,
            email: payload.email,
            role: payload.role,
        });
        
        // 4. Blacklist old refresh token (rotation)
        await blacklistToken(oldRefreshToken);
        
        logger.info('Tokens refreshed successfully', { userId: payload.userId });
        
        return newTokens;
    } catch (error) {
        logger.error('Token refresh failed', { error: (error as Error).message });
        throw error;
    }
}
