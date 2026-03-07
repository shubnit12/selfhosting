export const authPaths = {
    '/auth/login': {
    post: {
        tags: ['Authentication'],
        summary: 'Login with email and password',
        description: 'Authenticate user and return JWT tokens. If 2FA is enabled, returns requires2FA flag instead of tokens.',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/LoginRequest' }
                }
            }
        },
        responses: {
            200: {
                description: 'Login response',
                content: {
                    'application/json': {
                        schema: {
                            oneOf: [
                                {
                                    type: 'object',
                                    description: 'Login successful (2FA not enabled)',
                                    required: ['message', 'accessToken', 'refreshToken', 'user'],
                                    properties: {
                                        message: { type: 'string', example: 'Login successful' },
                                        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                                        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                                        user: {
                                            type: 'object',
                                            required: ['id', 'username', 'email', 'role', 'storage_quota', 'storage_used', 'two_fa_enabled'],
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                username: { type: 'string', example: 'shubnit' },
                                                email: { type: 'string', example: 'shubnit12@gmail.com' },
                                                role: { type: 'string', enum: ['admin', 'user'], example: 'admin' },
                                                storage_quota: { type: 'number', nullable: true, example: null },
                                                storage_used: { type: 'number', example: 0 },
                                                two_fa_enabled: { type: 'boolean', example: false }
                                            }
                                        }
                                    }
                                },
                                {
                                    type: 'object',
                                    description: '2FA required (user has 2FA enabled)',
                                    required: ['requires2FA', 'message', 'userId'],
                                    properties: {
                                        requires2FA: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Please provide 2FA token' },
                                        userId: { type: 'string', format: 'uuid', example: 'user-uuid-123', description: 'User ID (needed for verify-2fa endpoint)' }
                                    }
                                }
                            ]
                        },
                        examples: {
                            'Login successful (no 2FA)': {
                                value: {
                                    message: 'Login successful',
                                    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    user: {
                                        id: 'c8f74852-9873-4bd3-9ec0-8b02d304fbe9',
                                        username: 'shubnit',
                                        email: 'shubnit12@gmail.com',
                                        role: 'admin',
                                        storage_quota: null,
                                        storage_used: 0,
                                        two_fa_enabled: false
                                    }
                                }
                            },
                            '2FA required': {
                                value: {
                                    requires2FA: true,
                                    message: 'Please provide 2FA token',
                                    userId: 'c8f74852-9873-4bd3-9ec0-8b02d304fbe9'
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Invalid credentials',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Invalid email or password': {
                                value: {
                                    error: 'Invalid email or password',
                                    message: 'Invalid email or password'
                                }
                            }
                        }
                    }
                }
            },
            429: {
                description: 'Too many requests (rate limited - 5 attempts per 15 minutes)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Too many requests',
                            message: 'Too many authentication attempts. Please try again in 15 minutes.'
                        }
                    }
                }
            }
        }
    }
},

    '/auth/verify-2fa': {
    post: {
        tags: ['Authentication'],
        summary: 'Verify 2FA token',
        description: 'Verify TOTP token after login when 2FA is enabled. Returns JWT tokens upon successful verification.',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['email', 'token'],
                        properties: {
                            email: {
                                type: 'string',
                                format: 'email',
                                example: 'shubnit12@gmail.com',
                                description: 'User email address'
                            },
                            token: {
                                type: 'string',
                                pattern: '^\\d{6}$',
                                example: '123456',
                                description: '6-digit TOTP code from authenticator app'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: '2FA verification successful',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { type: 'string', example: 'Login successful' },
                                accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                                refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                                user: { $ref: '#/components/schemas/User' }
                            }
                        }
                    }
                }
            },
            400: {
                description: '2FA not enabled for this user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            401: {
                description: 'Invalid 2FA token',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            429: {
                description: 'Too many requests (rate limited)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
    },

    '/auth/register': {
        post: {
            tags: ['Authentication'],
            summary: 'Register new user (Admin only)',
            description: 'Create a new user account. Requires admin authentication.',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/RegisterRequest' }
                    }
                }
            },
            responses: {
                201: {
                    description: 'User created successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' },
                                    user: { $ref: '#/components/schemas/User' }
                                }
                            }
                        }
                    }
                },
                401: { description: 'Not authenticated' },
                403: { description: 'Not authorized (admin only)' },
                409: { description: 'User already exists' }
            }
        }
    },

    '/auth/setup-2fa': {
    post: {
        tags: ['Authentication'],
        summary: 'Setup 2FA',
        description: 'Generate 2FA secret and QR code for Google Authenticator. Returns secret, QR code, and backup codes.',
        security: [{ bearerAuth: [] }],
        responses: {
            200: {
                description: '2FA setup successful',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message', 'secret', 'qrCode', 'backupCodes'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: '2FA setup initiated',
                                    description: 'Success message'
                                },
                                secret: {
                                    type: 'string',
                                    example: 'JBSWY3DPEHPK3PXP',
                                    description: 'Base32 encoded secret (stored in database, shown once)'
                                },
                                qrCode: {
                                    type: 'string',
                                    example: 'data:image/png;base64,iVBORw0KGgo...',
                                    description: 'QR code as data URL (scan with Google Authenticator)'
                                },
                                backupCodes: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    example: ['A3F7B2C9', 'D8E1F4A6', '5B9C2E7F', '1A4D8F3B', '7E2C9A5D', 'F6B1D4E8', '3C7A2F9B', '8D5E1B4A'],
                                    description: '8 one-time backup codes (save these securely!)'
                                }
                            }
                        },
                        example: {
                            message: '2FA setup initiated',
                            secret: 'JBSWY3DPEHPK3PXP',
                            qrCode: 'data:image/png;base64,iVBORw0KGgo...',
                            backupCodes: ['A3F7B2C9', 'D8E1F4A6', '5B9C2E7F', '1A4D8F3B', '7E2C9A5D', 'F6B1D4E8', '3C7A2F9B', '8D5E1B4A']
                        }
                    }
                }
            },
            400: {
                description: '2FA is already enabled',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: '2FA is already enabled',
                            message: '2FA is already enabled'
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
},

'/auth/enable-2fa': {
    post: {
        tags: ['Authentication'],
        summary: 'Enable 2FA',
        description: 'Enable 2FA after verifying token. Must call /setup-2fa first to get secret.',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/TwoFactorTokenRequest' }
                }
            }
        },
        responses: {
            200: {
                description: '2FA enabled successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message', 'success'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: '2FA enabled successfully'
                                },
                                success: {
                                    type: 'boolean',
                                    example: true
                                }
                            }
                        },
                        example: {
                            message: '2FA enabled successfully',
                            success: true
                        }
                    }
                }
            },
            400: {
                description: '2FA is already enabled or not set up',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Already enabled': {
                                value: {
                                    error: '2FA is already enabled',
                                    message: '2FA is already enabled'
                                }
                            },
                            'Not set up': {
                                value: {
                                    error: '2FA not set up. Call /setup-2fa first',
                                    message: '2FA not set up. Call /setup-2fa first'
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Invalid token or not authenticated',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Invalid 2FA token',
                            message: 'Invalid 2FA token'
                        }
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
},

    '/auth/refresh': {
        post: {
            tags: ['Authentication'],
            summary: 'Refresh access token',
            description: 'Get new access and refresh tokens (old refresh token is invalidated)',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/RefreshTokenRequest' }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Tokens refreshed successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' },
                                    accessToken: { type: 'string' },
                                    refreshToken: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                401: { description: 'Invalid or expired refresh token' }
            }
        }
    },

    '/auth/logout': {
    post: {
        tags: ['Authentication'],
        summary: 'Logout',
        description: 'Logout user and blacklist access token. Optionally provide refresh token to blacklist it as well for complete logout.',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: false,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            refreshToken: {
                                type: 'string',
                                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                description: 'Optional refresh token to blacklist (recommended for complete logout)'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Logged out successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Logged out successfully'
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated or no token provided',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
    },

    '/auth/disable-2fa': {
    post: {
        tags: ['Authentication'],
        summary: 'Disable 2FA',
        description: 'Disable Two-Factor Authentication for the current user. Requires verification with current 2FA token.',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['token'],
                        properties: {
                            token: {
                                type: 'string',
                                pattern: '^\\d{6}$',
                                example: '123456',
                                description: '6-digit TOTP code from authenticator app to confirm disabling'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: '2FA disabled successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { 
                                    type: 'string', 
                                    example: '2FA disabled successfully' 
                                },
                                success: { 
                                    type: 'boolean', 
                                    example: true 
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: '2FA is not enabled',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            401: {
                description: 'Not authenticated or invalid 2FA token',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            404: {
                description: 'User not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
    },
};