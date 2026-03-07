import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ========================================
// VALIDATION SCHEMAS
// ========================================

// Register/Login validation
export const registerSchema = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
            'string.alphanum': 'Username must contain only letters and numbers',
            'string.min': 'Username must be at least 3 characters',
            'string.max': 'Username cannot exceed 30 characters',
            'any.required': 'Username is required'
        }),
    
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
    
    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters',
            'string.max': 'Password cannot exceed 128 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            'any.required': 'Password is required'
        }),
    
    role: Joi.string()
        .valid('admin', 'user')
        .default('user')
        .messages({
            'any.only': 'Role must be either admin or user'
        }),
    
    storage_quota: Joi.number()
        .integer()
        .min(0)
        .allow(null)
        .optional()
        .messages({
            'number.min': 'Storage quota must be a positive number'
        })
});

export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
    
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});


export const verify2FASchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
    token: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': '2FA token must be exactly 6 digits',
            'string.pattern.base': '2FA token must contain only numbers',
            'any.required': '2FA token is required'
        })
});
// 2FA validation
export const twoFactorTokenSchema = Joi.object({
    token: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': '2FA token must be exactly 6 digits',
            'string.pattern.base': '2FA token must contain only numbers',
            'any.required': '2FA token is required'
        })
});

// Refresh token validation
export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string()
        .required()
        .messages({
            'any.required': 'Refresh token is required'
        })
});

// ========================================
// VALIDATION MIDDLEWARE FACTORY
// ========================================

/**
 * Create validation middleware for a schema
 * @param schema - Joi schema to validate against
 * @param property - Which part of request to validate (body, query, params)
 */
export function validate(
    schema: Joi.ObjectSchema,
    property: 'body' | 'query' | 'params' = 'body'
) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,  // Return all errors, not just first
            stripUnknown: true, // Remove unknown fields
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.warn('Validation failed', {
                path: req.path,
                errors
            });

            res.status(400).json({
                error: 'Validation failed',
                message: 'Invalid input data',
                details: errors
            });
            return;
        }

        // Replace request data with validated/sanitized data
        req[property] = value;

        next();
    };
}

// ========================================
// FILE VALIDATION SCHEMAS
// ========================================

// Check duplicate schema
export const checkDuplicateSchema = Joi.object({
    file_hash: Joi.string()
        .length(64)
        .pattern(/^[a-f0-9]{64}$/)
        .required()
        .messages({
            'string.length': 'File hash must be exactly 64 characters',
            'string.pattern.base': 'File hash must be a valid SHA256 hash (hex)',
            'any.required': 'File hash is required'
        }),
    file_size: Joi.number()
        .integer()
        .min(1)
        .max(107374182400)  // 100GB
        .required()
        .messages({
            'number.min': 'File size must be at least 1 byte',
            'number.max': 'File size cannot exceed 100GB',
            'any.required': 'File size is required'
        }),
    filename: Joi.string()
        .min(1)
        .max(255)
        .required()
        .messages({
            'string.min': 'Filename cannot be empty',
            'string.max': 'Filename too long (max 255 characters)',
            'any.required': 'Filename is required'
        }),
    mime_type: Joi.string()
        .required()
        .messages({
            'any.required': 'MIME type is required'
        }),
    folder_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'Folder ID must be a valid UUID'
        })
});

// Initialize chunked upload schema
export const initChunkedUploadSchema = Joi.object({
    filename: Joi.string()
        .min(1)
        .max(255)
        .required()
        .messages({
            'string.min': 'Filename cannot be empty',
            'string.max': 'Filename too long',
            'any.required': 'Filename is required'
        }),
    file_size: Joi.number()
        .integer()
        .min(1)
        .max(107374182400)  // 100GB
        .required()
        .messages({
            'number.max': 'File size cannot exceed 100GB',
            'any.required': 'File size is required'
        }),
    file_hash: Joi.string()
        .length(64)
        .pattern(/^[a-f0-9]{64}$/)
        .required()
        .messages({
            'string.length': 'File hash must be 64 characters',
            'any.required': 'File hash is required'
        }),
    mime_type: Joi.string()
        .required()
        .messages({
            'any.required': 'MIME type is required'
        }),
    total_chunks: Joi.number()
        .integer()
        .min(1)
        .max(10000)  // Max 10,000 chunks (reasonable limit)
        .required()
        .messages({
            'number.min': 'Total chunks must be at least 1',
            'number.max': 'Too many chunks (max 10,000)',
            'any.required': 'Total chunks is required'
        }),
    folder_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
});

// Upload chunk schema
export const uploadChunkSchema = Joi.object({
    upload_session_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'Upload session ID must be a valid UUID',
            'any.required': 'Upload session ID is required'
        }),
    chunk_index: Joi.number()
        .integer()
        .min(0)
        .required()
        .messages({
            'number.min': 'Chunk index must be 0 or greater',
            'any.required': 'Chunk index is required'
        })
});

// Complete upload schema
export const completeUploadSchema = Joi.object({
    upload_session_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'Upload session ID must be a valid UUID',
            'any.required': 'Upload session ID is required'
        }),
    file_hash: Joi.string()
        .length(64)
        .pattern(/^[a-f0-9]{64}$/)
        .required()
        .messages({
            'string.length': 'File hash must be 64 characters',
            'any.required': 'File hash is required'
        })
});
// ========================================
// FOLDER VALIDATION SCHEMAS
// ========================================

// Create folder schema
export const createFolderSchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(255)
        .pattern(/^[^/\\:*?"<>|]+$/)  // No special filesystem characters
        .required()
        .messages({
            'string.min': 'Folder name cannot be empty',
            'string.max': 'Folder name too long (max 255 characters)',
            'string.pattern.base': 'Folder name contains invalid characters (/, \\, :, *, ?, ", <, >, |)',
            'any.required': 'Folder name is required'
        }),
    parent_folder_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'Parent folder ID must be a valid UUID'
        })
});

// Rename folder schema
export const renameFolderSchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(255)
        .pattern(/^[^/\\:*?"<>|]+$/)
        .required()
        .messages({
            'string.min': 'Folder name cannot be empty',
            'string.max': 'Folder name too long',
            'string.pattern.base': 'Folder name contains invalid characters',
            'any.required': 'Folder name is required'
        })
});

// ========================================
// SHARE LINK VALIDATION SCHEMAS
// ========================================

// Create share link schema
export const createShareLinkSchema = Joi.object({
    file_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.uuid': 'File ID must be a valid UUID',
            'any.required': 'File ID is required'
        }),
    password: Joi.string()
        .min(4)
        .max(128)
        .optional()
        .messages({
            'string.min': 'Password must be at least 4 characters',
            'string.max': 'Password too long'
        }),
    expires_at: Joi.date()
        .iso()
        .optional()
        .allow(null)
        .messages({
            'date.format': 'Expiration date must be in ISO format'
        }),
    max_downloads: Joi.number()
        .integer()
        .min(1)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'Max downloads must be at least 1'
        }),
    allow_preview: Joi.boolean()
        .optional()
        .default(true)
});

// Update share link schema
export const updateShareLinkSchema = Joi.object({
    expires_at: Joi.date()
        .iso()
        .optional()
        .allow(null),
    max_downloads: Joi.number()
        .integer()
        .min(1)
        .optional()
        .allow(null),
    is_active: Joi.boolean()
        .optional(),
    password: Joi.string()
        .min(4)
        .max(128)
        .optional()
});

// Verify password schema
export const verifyPasswordSchema = Joi.object({
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

export const moveFileSchema = Joi.object({
    folder_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.uuid': 'Folder ID must be a valid UUID'
        })
});