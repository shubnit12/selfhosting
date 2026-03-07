export const schemas = {
    User: {
        type: 'object',
        properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string', example: 'john' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            role: { type: 'string', enum: ['admin', 'user'], example: 'user' },
            storage_quota: { type: 'number', nullable: true, example: 21474836480 },
            storage_used: { type: 'number', example: 0 },
            two_fa_enabled: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
        }
    },

    LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email', example: 'shubnit12@gmail.com' },
            password: { type: 'string', format: 'password', example: 'MyPassword123' }
        }
    },

    LoginResponse: {
        type: 'object',
        properties: {
            message: { type: 'string', example: 'Login successful' },
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' }
        }
    },

    RegisterRequest: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
            username: { type: 'string', example: 'john' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', format: 'password', example: 'MyPassword123' },
            role: { type: 'string', enum: ['admin', 'user'], default: 'user' },
            storage_quota: { type: 'number', nullable: true, example: 21474836480 }
        }
    },

    TwoFactorTokenRequest: {
        type: 'object',
        required: ['token'],
        properties: {
            token: { type: 'string', pattern: '^\\d{6}$', example: '123456' }
        }
    },

    TwoFactorSetupResponse: {
        type: 'object',
        properties: {
            message: { type: 'string' },
            secret: { type: 'string', example: 'JBSWY3DPEHPK3PXP' },
            qrCode: { type: 'string', example: 'data:image/png;base64,...' },
            backupCodes: { type: 'array', items: { type: 'string' }, example: ['A3F7B2C9', 'D8E1F4A6'] }
        }
    },

    RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
        }
    },

    File: {
        type: 'object',
        properties: {
            id: { type: 'string', format: 'uuid', example: 'abc-123-def-456' },
            original_name: { type: 'string', example: 'vacation_video.mp4' },
            stored_name: { type: 'string', example: 'abcdef123456.mp4' },
            file_path: { type: 'string', example: '/ab/cd/abcdef123456.mp4' },
            file_hash: { type: 'string', example: 'abcdef123456789...' },
            mime_type: { type: 'string', example: 'video/mp4' },
            size: { type: 'number', example: 524288000 },
            upload_status: { type: 'string', enum: ['uploading', 'completed', 'failed'], example: 'completed' },
            is_available: { type: 'boolean', example: true },
            version: { type: 'number', example: 1 },
            created_at: { type: 'string', format: 'date-time' },
            folder_id: { type: 'string', format: 'uuid', nullable: true }
        }
    },

    CheckDuplicateRequest: {
        type: 'object',
        required: ['file_hash', 'file_size', 'filename', 'mime_type'],
        properties: {
            file_hash: {
                type: 'string',
                pattern: '^[a-f0-9]{64}$',
                example: 'abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcd',
                description: 'SHA256 hash of file (64 hex characters)'
            },
            file_size: {
                type: 'number',
                example: 524288000,
                description: 'File size in bytes'
            },
            filename: {
                type: 'string',
                example: 'vacation_video.mp4',
                description: 'Original filename'
            },
            mime_type: {
                type: 'string',
                example: 'video/mp4',
                description: 'MIME type'
            },
            folder_id: {
                type: 'string',
                format: 'uuid',
                nullable: true,
                example: null,
                description: 'Folder ID (null = root)'
            }
        }
    },

    InitUploadRequest: {
        type: 'object',
        required: ['filename', 'file_size', 'file_hash', 'mime_type', 'total_chunks'],
        properties: {
            filename: { type: 'string', example: 'large_video.mp4' },
            file_size: { type: 'number', example: 5368709120, description: '5GB in bytes' },
            file_hash: { type: 'string', example: 'abc123def456...' },
            mime_type: { type: 'string', example: 'video/mp4' },
            total_chunks: { type: 'number', example: 50, description: 'Number of 100MB chunks' },
            folder_id: { type: 'string', format: 'uuid', nullable: true }
        }
    },

    InitUploadResponse: {
        type: 'object',
        properties: {
            upload_session_id: { type: 'string', format: 'uuid', example: 'session-uuid-123' },
            chunk_size: { type: 'number', example: 104857600, description: '100MB in bytes' },
            total_chunks: { type: 'number', example: 50 },
            expires_at: { type: 'string', format: 'date-time' },
            message: { type: 'string', example: 'Upload session created' }
        }
    },

    UploadChunkRequest: {
        type: 'object',
        required: ['upload_session_id', 'chunk_index'],
        properties: {
            upload_session_id: { type: 'string', format: 'uuid' },
            chunk_index: { type: 'number', example: 0, description: 'Chunk number (0-based)' },
            chunk: { type: 'string', format: 'binary', description: 'Chunk file data (multipart/form-data)' }
        }
    },

    ChunkUploadResponse: {
        type: 'object',
        properties: {
            chunk_index: { type: 'number', example: 0 },
            received: { type: 'number', example: 1, description: 'Total chunks received' },
            total_chunks: { type: 'number', example: 50 },
            chunks_remaining: { type: 'number', example: 49 },
            progress_percentage: { type: 'string', example: '2.00' }
        }
    },

    CompleteUploadRequest: {
        type: 'object',
        required: ['upload_session_id', 'file_hash'],
        properties: {
            upload_session_id: { type: 'string', format: 'uuid' },
            file_hash: { type: 'string', example: 'abc123def456...' }
        }
    },

    UploadStatusResponse: {
        type: 'object',
        properties: {
            session_id: { type: 'string', format: 'uuid' },
            filename: { type: 'string', example: 'video.mp4' },
            total_chunks: { type: 'number', example: 50 },
            chunks_received: { type: 'array', items: { type: 'number' }, example: [0, 1, 2, 5, 6] },
            chunks_missing: { type: 'array', items: { type: 'number' }, example: [3, 4, 7, 8, 9] },
            progress_percentage: { type: 'string', example: '10.00' },
            expires_at: { type: 'string', format: 'date-time' }
        }
    },

    FileListResponse: {
        type: 'object',
        properties: {
            files: {
                type: 'array',
                items: { $ref: '#/components/schemas/File' }
            },
            pagination: {
                type: 'object',
                properties: {
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 50 },
                    total: { type: 'number', example: 150 },
                    totalPages: { type: 'number', example: 3 }
                }
            }
        }
    },

    Error: {
        type: 'object',
        properties: {
            error: { type: 'string', example: 'Validation failed' },
            message: { type: 'string', example: 'Invalid input data' },
            details: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        field: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    },


    ShareLink: {
        type: 'object',
        properties: {
            id: { type: 'string', format: 'uuid' },
            token: { type: 'string', example: 'a7b3c9d2e5f8g1h4j6k8m0n2p4q6r8s0...' },
            public_url: { type: 'string', example: 'https://yoursite.com/share/a7b3c9d2...' },
            file_id: { type: 'string', format: 'uuid' },
            has_password: { type: 'boolean', example: true },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            max_downloads: { type: 'number', nullable: true, example: 10 },
            download_count: { type: 'number', example: 3 },
            allow_preview: { type: 'boolean', example: true },
            is_active: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            last_accessed_at: { type: 'string', format: 'date-time', nullable: true }
        }
    },

    CreateShareLinkRequest: {
        type: 'object',
        required: ['file_id'],
        properties: {
            file_id: { type: 'string', format: 'uuid', example: 'file-uuid-123' },
            password: { type: 'string', example: 'secret123', description: 'Optional password protection' },
            expires_at: { type: 'string', format: 'date-time', example: '2026-03-01T00:00:00Z', description: 'Expiration date (null = never)' },
            max_downloads: { type: 'number', example: 10, description: 'Max downloads (null = unlimited)' },
            allow_preview: { type: 'boolean', default: true, description: 'Allow preview before download' }
        }
    },

    ShareLinkInfoResponse: {
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
            downloads_remaining: { type: 'number', nullable: true, example: 7 },
            expires_at: { type: 'string', format: 'date-time', nullable: true }
        }
    }
};