import { Request, Response } from 'express';
import { User } from '../models';
import { 
    hashPassword, 
    comparePassword, 
    generateTokenPair,
    refreshTokens,
    blacklistToken 
} from '../services/authService';
import {
    generateTwoFactorSecret,
    verifyTwoFactorToken
} from '../services/twoFactorService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { ActivityAction } from '../models/ActivityLog';
import ActivityLog from '../models/ActivityLog';

// ========================================
// REGISTER (Admin Only)
// ========================================

/**
 * POST /api/v1/auth/register
 * Create new user (admin only)
 */
export async function register(req: Request, res: Response): Promise<void> {
    try {
        const { username, email, password, role, storage_quota } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            where: { email }
        });

        if (existingUser) {
            throw new AppError('User with this email already exists', 409);
        }

        // Check username uniqueness
        const existingUsername = await User.findOne({
            where: { username }
        });

        if (existingUsername) {
            throw new AppError('Username already taken', 409);
        }

        // Hash password
        const password_hash = await hashPassword(password);

        // Create user
        const user = await User.create({
            username,
            email,
            password_hash,
            role: role || 'user',
            storage_quota: storage_quota || (role === 'admin' ? null : 21474836480), // 20GB default
        });

        // Log activity
        await ActivityLog.log(ActivityAction.CREATE_USER, {
            userId: req.user?.userId, // Admin who created the user
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
                created_user_id: user.id,
                created_username: user.username,
                role: user.role
            }
        });

        logger.info('User registered successfully', {
            userId: user.id,
            username: user.username,
            createdBy: req.user?.userId
        });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                storage_quota: user.storage_quota
            }
        });

    } catch (error) {
        logger.error('Registration failed', {
            error: (error as Error).message,
            email: req.body.email
        });
        throw error;
    }
}

// ========================================
// LOGIN
// ========================================

/**
 * POST /api/v1/auth/login
 * Login with email + password
 */
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ where: { email } });

        if (!user) {
            // Don't reveal if user exists or not (security)
            throw new AppError('User not found', 401);
        }
        // Check if user account is active
if (!user.is_active) {
    throw new AppError('Account has been deactivated. Contact administrator.', 403);
}
        // Verify password
        const isPasswordValid = await comparePassword(password, user.password_hash);

        if (!isPasswordValid) {
            // Log failed login
            await ActivityLog.log(ActivityAction.LOGIN, {
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: {
                    success: false,
                    reason: 'Invalid password'
                }
            });

            throw new AppError('Invalid email or password', 401);
        }

        // Check if 2FA is enabled
        if (user.two_fa_enabled) {
            logger.info('2FA required for login', { userId: user.id });

            res.json({
                requires2FA: true,
                message: 'Please provide 2FA token',
                userId: user.id  // Frontend needs this for verify-2fa endpoint
            });
            return;
        }

        // Generate tokens
        const tokens = generateTokenPair({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        });

        // Log successful login
        await ActivityLog.log(ActivityAction.LOGIN, {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
                success: true,
                two_fa_used: false
            }
        });

        logger.info('User logged in successfully', {
            userId: user.id,
            username: user.username
        });

        res.json({
            message: 'Login successful',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                storage_quota: user.storage_quota,
                storage_used: user.storage_used,
                two_fa_enabled: user.two_fa_enabled
            }
        });

    } catch (error) {
        logger.error('Login failed', {
            error: (error as Error).message,
            email: req.body.email
        });
        throw error;
    }
}

// ========================================
// VERIFY 2FA
// ========================================

/**
 * POST /api/v1/auth/verify-2fa
 * Verify 2FA token after login
 */
export async function verify2FA(req: Request, res: Response): Promise<void> {
    try {
        const { email, token } = req.body;

        // Find user
        const user = await User.findOne({ where: { email } });

        if (!user || !user.two_fa_enabled || !user.two_fa_secret) {
            throw new AppError('2FA not enabled for this user', 400);
        }

        // Verify TOTP token
        const isValid = verifyTwoFactorToken(token, user.two_fa_secret);

        if (!isValid) {
            // Log failed 2FA attempt
            await ActivityLog.log(ActivityAction.LOGIN, {
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: {
                    success: false,
                    reason: 'Invalid 2FA token'
                }
            });

            throw new AppError('Invalid 2FA token', 401);
        }

        // Generate tokens
        const tokens = generateTokenPair({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        });

        // Log successful login with 2FA
        await ActivityLog.log(ActivityAction.LOGIN, {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
                success: true,
                two_fa_used: true
            }
        });

        logger.info('User logged in with 2FA', {
            userId: user.id,
            username: user.username
        });

        res.json({
            message: 'Login successful',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                storage_quota: user.storage_quota,
                storage_used: user.storage_used,
                two_fa_enabled: user.two_fa_enabled
            }
        });

    } catch (error) {
        logger.error('2FA verification failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

// ========================================
// SETUP 2FA
// ========================================

/**
 * POST /api/v1/auth/setup-2fa
 * Generate 2FA secret and QR code
 */
export async function setup2FA(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        // Find user
        const user = await User.findByPk(req.user.userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.two_fa_enabled) {
            throw new AppError('2FA is already enabled', 400);
        }

        // Generate 2FA secret
        const twoFactorSetup = await generateTwoFactorSecret(user.username);

        // Save secret to user (but don't enable yet)
        await user.update({
            two_fa_secret: twoFactorSetup.secret
        });

        logger.info('2FA setup initiated', {
            userId: user.id,
            username: user.username
        });

        res.json({
            message: '2FA setup initiated',
            secret: twoFactorSetup.secret,
            qrCode: twoFactorSetup.qrCodeUrl,
            backupCodes: twoFactorSetup.backupCodes
        });

    } catch (error) {
        logger.error('2FA setup failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// ENABLE 2FA
// ========================================

/**
 * POST /api/v1/auth/enable-2fa
 * Enable 2FA after verifying token
 */
export async function enable2FA(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { token } = req.body;

        // Find user
        const user = await User.findByPk(req.user.userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.two_fa_enabled) {
            throw new AppError('2FA is already enabled', 400);
        }

        if (!user.two_fa_secret) {
            throw new AppError('2FA not set up. Call /setup-2fa first', 400);
        }

        // Verify token
        const isValid = verifyTwoFactorToken(token, user.two_fa_secret);

        if (!isValid) {
            throw new AppError('Invalid 2FA token', 401);
        }

        // Enable 2FA
        await user.update({
            two_fa_enabled: true
        });

        // Log activity
        await ActivityLog.log(ActivityAction.ENABLE_2FA, {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        logger.info('2FA enabled', {
            userId: user.id,
            username: user.username
        });

        res.json({
            message: '2FA enabled successfully',
            success: true
        });

    } catch (error) {
        logger.error('Enable 2FA failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// DISABLE 2FA
// ========================================

/**
 * POST /api/v1/auth/disable-2fa
 * Disable 2FA
 */
export async function disable2FA(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        const { token } = req.body;

        // Find user
        const user = await User.findByPk(req.user.userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (!user.two_fa_enabled) {
            throw new AppError('2FA is not enabled', 400);
        }

        // Verify token before disabling
        const isValid = verifyTwoFactorToken(token, user.two_fa_secret!);

        if (!isValid) {
            throw new AppError('Invalid 2FA token', 401);
        }

        // Disable 2FA
        await user.update({
            two_fa_enabled: false,
            two_fa_secret: null
        });

        // Log activity
        await ActivityLog.log(ActivityAction.DISABLE_2FA, {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        logger.info('2FA disabled', {
            userId: user.id,
            username: user.username
        });

        res.json({
            message: '2FA disabled successfully',
            success: true
        });

    } catch (error) {
        logger.error('Disable 2FA failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}

// ========================================
// REFRESH TOKEN (with Rotation)
// ========================================

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
export async function refresh(req: Request, res: Response): Promise<void> {
    try {
        const { refreshToken } = req.body;

        // Refresh tokens with rotation (old token blacklisted)
        const newTokens = await refreshTokens(refreshToken);

        logger.info('Tokens refreshed successfully');

        res.json({
            message: 'Tokens refreshed successfully',
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken
        });

    } catch (error) {
        logger.error('Token refresh failed', {
            error: (error as Error).message
        });
        throw error;
    }
}

// ========================================
// LOGOUT
// ========================================

/**
 * POST /api/v1/auth/logout
 * Logout user (blacklist token)
 */
export async function logout(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new AppError('No access token provided', 401);
        }

        const token = authHeader.substring(7); // Remove 'Bearer '
        // Get refresh token from body (user should send it)
        const { refreshToken } = req.body;
        // Blacklist the token
        await blacklistToken(token);

        if (refreshToken) {
            await blacklistToken(refreshToken);
            logger.info('Both tokens blacklisted', {
                userId: req.user.userId
            });
        } else {
            logger.warn('Trying to Logout without refresh token', {
                userId: req.user.userId
            });
        }

        // Log activity
        await ActivityLog.log(ActivityAction.LOGOUT, {
            userId: req.user.userId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        logger.info('User logged out', {
            userId: req.user.userId,
            username: req.user.username
        });

        res.json({
            message: 'Logged out successfully'
        });

    } catch (error) {
        logger.error('Logout failed', {
            error: (error as Error).message,
            userId: req.user?.userId
        });
        throw error;
    }
}