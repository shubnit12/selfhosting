import { Router } from 'express';
import {
    register,
    login,
    verify2FA,
    setup2FA,
    enable2FA,
    disable2FA,
    refresh,
    logout
} from '../../../controllers/authController';
import { authenticateToken } from '../../../middleware/auth';
import { adminOnly } from '../../../middleware/adminOnly';
import { authRateLimiter } from '../../../middleware/rateLimiter';
import { validate } from '../../../middleware/validators';
import {
    registerSchema,
    loginSchema,
    verify2FASchema,
    twoFactorTokenSchema,
    refreshTokenSchema
} from '../../../middleware/validators';

const router = Router();

// ========================================
// PUBLIC ROUTES (No authentication required)
// ========================================

/**
 * POST /api/v1/auth/login
 * Login with email + password
 */

router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post(
    '/login',
    authRateLimiter,              // Rate limit: 5 req/15min
    validate(loginSchema),        // Validate input
    login                         // Controller
);

/**
 * POST /api/v1/auth/verify-2fa
 * Verify 2FA token after login
 */
router.post(
    '/verify-2fa',
    authRateLimiter,
    validate(verify2FASchema),
    verify2FA
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
    '/refresh',
    validate(refreshTokenSchema),
    refresh
);

// ========================================
// PROTECTED ROUTES (Authentication required)
// ========================================

/**
 * POST /api/v1/auth/register
 * Create new user (admin only)
 */
router.post(
    '/register',
    authenticateToken,            // Must be logged in
    adminOnly,                    // Must be admin
    validate(registerSchema),     // Validate input
    register                      // Controller
);

/**
 * POST /api/v1/auth/setup-2fa
 * Setup 2FA (get QR code)
 */
router.post(
    '/setup-2fa',
    authenticateToken,
    setup2FA
);

/**
 * POST /api/v1/auth/enable-2fa
 * Enable 2FA after verification
 */
router.post(
    '/enable-2fa',
    authenticateToken,
    validate(twoFactorTokenSchema),
    enable2FA
);

/**
 * POST /api/v1/auth/disable-2fa
 * Disable 2FA
 */
router.post(
    '/disable-2fa',
    authenticateToken,
    validate(twoFactorTokenSchema),
    disable2FA
);

/**
 * POST /api/v1/auth/logout
 * Logout (blacklist token)
 */
router.post(
    '/logout',
    authenticateToken,
    logout
);

export default router;