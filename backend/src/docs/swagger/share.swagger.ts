export const sharePaths = {
    '/share': {
        post: {
            tags: ['Share Links'],
            summary: 'Create share link',
            description: 'Create public shareable link for a file. Link can be password-protected, have expiration date, and download limits.',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['file_id'],
                            properties: {
                                file_id: { 
                                    type: 'string', 
                                    format: 'uuid',
                                    example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                    description: 'ID of file to share'
                                },
                                password: { 
                                    type: 'string', 
                                    minLength: 4,
                                    maxLength: 128,
                                    example: 'secret123',
                                    description: 'Optional password protection'
                                },
                                expires_at: { 
                                    type: 'string', 
                                    format: 'date-time',
                                    example: '2026-03-01T00:00:00.000Z',
                                    description: 'Expiration date in ISO format (null = never expires)'
                                },
                                max_downloads: { 
                                    type: 'number',
                                    minimum: 1,
                                    example: 10,
                                    description: 'Maximum number of downloads (null = unlimited)'
                                },
                                allow_preview: { 
                                    type: 'boolean',
                                    default: true,
                                    example: true,
                                    description: 'Allow file preview before download'
                                }
                            }
                        },
                        examples: {
                            'Simple share (no restrictions)': {
                                value: {
                                    file_id: '112a0abe-7012-49e2-8dc2-70abe96de52f'
                                }
                            },
                            'Password protected with expiration': {
                                value: {
                                    file_id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                    password: 'secret123',
                                    expires_at: '2026-03-01T00:00:00.000Z',
                                    max_downloads: 10,
                                    allow_preview: true
                                }
                            },
                            'Download limit only': {
                                value: {
                                    file_id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                    max_downloads: 5,
                                    allow_preview: true
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                201: {
                    description: 'Share link created successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { 
                                        type: 'string', 
                                        example: 'Share link created successfully' 
                                    },
                                    share_link: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', format: 'uuid', example: 'link-uuid-123' },
                                            token: { type: 'string', example: 'a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8' },
                                            public_url: { type: 'string', example: 'http://localhost:5173/share/a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8' },
                                            expires_at: { type: 'string', format: 'date-time', nullable: true },
                                            max_downloads: { type: 'number', nullable: true, example: 10 },
                                            download_count: { type: 'number', example: 0 },
                                            allow_preview: { type: 'boolean', example: true },
                                            is_active: { type: 'boolean', example: true },
                                            created_at: { type: 'string', format: 'date-time' }
                                        }
                                    }
                                }
                            },
                            example: {
                                message: 'Share link created successfully',
                                share_link: {
                                    id: 'abc-123-def-456',
                                    token: 'a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8',
                                    public_url: 'http://localhost:5173/share/a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8',
                                    expires_at: '2026-03-01T00:00:00.000Z',
                                    max_downloads: 10,
                                    download_count: 0,
                                    allow_preview: true,
                                    is_active: true,
                                    created_at: '2026-02-22T07:00:00.000Z'
                                }
                            }
                        }
                    }
                },
                400: { 
                    description: 'Cannot share deleted file',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                401: { description: 'Not authenticated' },
                403: { description: 'Unauthorized (not file owner)' },
                404: { description: 'File not found' }
            }
        }
    },

    '/share/my-links': {
        get: {
            tags: ['Share Links'],
            summary: 'Get user\'s share links',
            description: 'Get list of all share links created by current user with file details.',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'active_only',
                    in: 'query',
                    required: false,
                    schema: { type: 'boolean', default: true },
                    description: 'Filter: true = only active links, false = all links'
                }
            ],
            responses: {
                200: {
                    description: 'Share links retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    share_links: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                token: { type: 'string' },
                                                public_url: { type: 'string' },
                                                file: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'string', format: 'uuid' },
                                                        name: { type: 'string' },
                                                        size: { type: 'number' }
                                                    }
                                                },
                                                has_password: { type: 'boolean' },
                                                expires_at: { type: 'string', format: 'date-time', nullable: true },
                                                max_downloads: { type: 'number', nullable: true },
                                                download_count: { type: 'number' },
                                                is_active: { type: 'boolean' },
                                                created_at: { type: 'string', format: 'date-time' },
                                                last_accessed_at: { type: 'string', format: 'date-time', nullable: true }
                                            }
                                        }
                                    }
                                }
                            },
                            example: {
                                share_links: [
                                    {
                                        id: 'link-uuid-1',
                                        token: 'a7b3c9d2e5f8...',
                                        public_url: 'http://localhost:5173/share/a7b3c9d2e5f8...',
                                        file: {
                                            id: 'file-uuid-1',
                                            name: 'vacation_video.mp4',
                                            size: 524288000
                                        },
                                        has_password: true,
                                        expires_at: '2026-03-01T00:00:00.000Z',
                                        max_downloads: 10,
                                        download_count: 3,
                                        is_active: true,
                                        created_at: '2026-02-22T07:00:00.000Z',
                                        last_accessed_at: '2026-02-22T08:30:00.000Z'
                                    }
                                ]
                            }
                        }
                    }
                },
                401: { description: 'Not authenticated' }
            }
        }
    },

    '/share/{token}': {
        get: {
            tags: ['Share Links'],
            summary: 'Get file info via share link (PUBLIC - No Auth Required)',
            description: 'Get file information using share token. Anyone with the token can access this. Returns file details and link restrictions.',
            parameters: [
                {
                    name: 'token',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', minLength: 64, maxLength: 64 },
                    description: 'Share link token (64-character hex string)',
                    example: 'a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8'
                }
            ],
            responses: {
                200: {
                    description: 'File information retrieved',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', example: 'vacation_video.mp4' },
                                            size: { type: 'number', example: 524288000 },
                                            mime_type: { type: 'string', example: 'video/mp4' }
                                        }
                                    },
                                    requires_password: { type: 'boolean', example: true },
                                    allow_preview: { type: 'boolean', example: true },
                                    downloads_remaining: { type: 'number', nullable: true, example: 7, description: 'null = unlimited' },
                                    expires_at: { type: 'string', format: 'date-time', nullable: true }
                                }
                            }
                        }
                    }
                },
                403: { 
                    description: 'Link expired, deactivated, or download limit reached',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            examples: {
                                'Expired': {
                                    value: {
                                        error: 'Share link has expired',
                                        message: 'An error occurred while processing your request'
                                    }
                                },
                                'Limit reached': {
                                    value: {
                                        error: 'Download limit reached',
                                        message: 'An error occurred while processing your request'
                                    }
                                }
                            }
                        }
                    }
                },
                404: { description: 'Share link not found' }
            }
        }
    },

    '/share/{token}/verify-password': {
        post: {
            tags: ['Share Links'],
            summary: 'Verify password (PUBLIC - No Auth Required)',
            description: 'Verify password for password-protected share link. Call this before downloading if requires_password is true.',
            parameters: [
                {
                    name: 'token',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    example: 'a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8'
                }
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['password'],
                            properties: {
                                password: { 
                                    type: 'string',
                                    example: 'secret123',
                                    description: 'Password for the share link'
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Password is correct',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    valid: { type: 'boolean', example: true },
                                    message: { type: 'string', example: 'Password verified' }
                                }
                            }
                        }
                    }
                },
                401: { 
                    description: 'Invalid password',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Invalid password',
                                message: 'Invalid password'
                            }
                        }
                    }
                },
                404: { description: 'Share link not found' }
            }
        }
    },

    '/share/{token}/download': {
        get: {
            tags: ['Share Links'],
            summary: 'Download file (PUBLIC - No Auth Required)',
            description: 'Download file via share link. No authentication required. If password-protected, provide password as query parameter. Download count is incremented.',
            parameters: [
                {
                    name: 'token',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    example: 'a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0t2u4v6w8x0y2z4a1b2c3d4e5f6g7h8'
                },
                {
                    name: 'password',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    example: 'secret123',
                    description: 'Password (required if link is password-protected)'
                }
            ],
            responses: {
                200: {
                    description: 'File download started',
                    content: {
                        'application/octet-stream': {
                            schema: {
                                type: 'string',
                                format: 'binary'
                            }
                        }
                    },
                    headers: {
                        'Content-Disposition': {
                            schema: { type: 'string' },
                            description: 'attachment; filename="vacation_video.mp4"'
                        },
                        'Content-Type': {
                            schema: { type: 'string' },
                            description: 'File MIME type (e.g., video/mp4)'
                        }
                    }
                },
                401: { description: 'Password required or invalid' },
                403: { description: 'Link expired or download limit reached' },
                404: { description: 'Share link not found' }
            }
        }
    },

    '/share/{id}': {
        put: {
            tags: ['Share Links'],
            summary: 'Update share link settings',
            description: 'Update share link configuration. Can change expiration, download limit, password, or deactivate link.',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', format: 'uuid' },
                    description: 'Share link ID (not token)'
                }
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                expires_at: { 
                                    type: 'string', 
                                    format: 'date-time',
                                    nullable: true,
                                    description: 'New expiration date (null = never expires)'
                                },
                                max_downloads: { 
                                    type: 'number',
                                    nullable: true,
                                    description: 'New download limit (null = unlimited)'
                                },
                                is_active: { 
                                    type: 'boolean',
                                    description: 'Activate or deactivate link'
                                },
                                password: { 
                                    type: 'string',
                                    description: 'New password (updates password hash)'
                                }
                            }
                        },
                        examples: {
                            'Extend expiration': {
                                value: {
                                    expires_at: '2026-04-01T00:00:00.000Z'
                                }
                            },
                            'Deactivate link': {
                                value: {
                                    is_active: false
                                }
                            },
                            'Change password': {
                                value: {
                                    password: 'newSecret456'
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Share link updated',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', example: 'Share link updated successfully' },
                                    share_link: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', format: 'uuid' },
                                            expires_at: { type: 'string', format: 'date-time', nullable: true },
                                            max_downloads: { type: 'number', nullable: true },
                                            is_active: { type: 'boolean' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                401: { description: 'Not authenticated' },
                403: { description: 'Unauthorized (not link creator)' },
                404: { description: 'Share link not found' }
            }
        },
        delete: {
            tags: ['Share Links'],
            summary: 'Deactivate share link',
            description: 'Deactivate share link. Link will no longer be accessible. This is permanent and cannot be undone.',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', format: 'uuid' },
                    description: 'Share link ID'
                }
            ],
            responses: {
                200: {
                    description: 'Share link deactivated',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', example: 'Share link deactivated' }
                                }
                            }
                        }
                    }
                },
                401: { description: 'Not authenticated' },
                403: { description: 'Unauthorized (not link creator)' },
                404: { description: 'Share link not found' }
            }
        }
    }
};