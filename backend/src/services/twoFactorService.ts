import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import logger from '../utils/logger';

// ========================================
// INTERFACES
// ========================================

interface TwoFactorSetup {
    secret: string;           // Base32 encoded secret
    qrCodeUrl: string;        // Data URL for QR code image
    backupCodes: string[];    // One-time backup codes
}

interface TwoFactorSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
}

// ========================================
// GENERATE 2FA SECRET
// ========================================

/**
 * Generate TOTP secret for user
 * @param username - User's username
 * @param issuer - App name (appears in authenticator app)
 */
export async function generateTwoFactorSecret(
    username: string,
    issuer: string = 'File Server'
): Promise<TwoFactorSetup> {
    try {
        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `${issuer} (${username})`,  // Shows in authenticator app
            issuer: issuer,
            length: 32,  // Secret length
        });

        logger.debug('2FA secret generated', { username });

        // Generate QR code as data URL
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

        // Generate backup codes
        const backupCodes = generateBackupCodes(8);  // 8 backup codes

        return {
            secret: secret.base32,  // Store this in database
            qrCodeUrl,              // Send to frontend for display
            backupCodes,            // Give to user (one-time use)
        };
    } catch (error) {
        logger.error('Failed to generate 2FA secret', { 
            error: (error as Error).message,
            username 
        });
        throw error;
    }
}

// ========================================
// VERIFY TOTP TOKEN
// ========================================

/**
 * Verify TOTP token from authenticator app
 * @param token - 6-digit code from user
 * @param secret - User's stored secret (base32)
 */
export function verifyTwoFactorToken(token: string, secret: string): boolean {
    try {
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 2,  // Allow 2 time steps (±60 seconds tolerance)
        });

        if (verified) {
            logger.debug('2FA token verified successfully');
        } else {
            logger.warn('2FA token verification failed', { token });
        }

        return verified;
    } catch (error) {
        logger.error('2FA verification error', { error: (error as Error).message });
        return false;
    }
}

// ========================================
// BACKUP CODES
// ========================================

/**
 * Generate backup codes (one-time use codes)
 * @param count - Number of backup codes to generate
 */
export function generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }

    logger.debug('Backup codes generated', { count });
    return codes;
}

/**
 * Hash backup code for storage (like passwords)
 */
export async function hashBackupCode(code: string): Promise<string> {
    // Use bcrypt to hash backup codes
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(code, 10);  // 10 rounds (faster than passwords)
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
    plainCode: string,
    hashedCode: string
): Promise<boolean> {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(plainCode, hashedCode);
}