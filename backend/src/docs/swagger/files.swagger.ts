export const filePaths = {
'/files/upload': {
    post: {
        tags: ['Files'],
        summary: 'Direct upload for small files (<100MB)',
        description: `
**Upload small files directly without chunking.**

**How it works:**
1. File uploaded via multipart/form-data (field name: "file")
2. Backend automatically calculates SHA256 hash
3. Checks for duplicates in system
4. If duplicate exists: Links to existing file instantly (no storage used)
5. If unique: Stores in hash-based directory (/ab/cd/hash.ext)
6. Creates file record in database
7. Updates user's storage quota
8. Logs upload activity

**Deduplication:**
- Same file uploaded by multiple users = stored once
- Each user sees their own filename
- Bandwidth saved (no upload if duplicate)
- Storage saved (single physical file)

**Storage quota:**
- Validated before upload
- Admin users: unlimited
- Regular users: 20GB default
- Counts against quota even if deduplicated

**When to use:**
- Files < 100MB (images, documents, PDFs, small videos)
- For files > 100MB: Use chunked upload (/files/upload/init)

**File storage:**
- Stored at: /storage/files/ab/cd/[hash][extension]
- Hash-based naming prevents conflicts
- Automatic directory creation
        `,
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        required: ['file'],
                        properties: {
                            file: {
                                type: 'string',
                                format: 'binary',
                                description: 'File to upload (max 100MB)'
                            },
                            folder_id: {
                                type: 'string',
                                format: 'uuid',
                                nullable: true,
                                description: 'Folder ID to upload to (omit or null = root directory)',
                                example: null
                            }
                        }
                    }
                }
            }
        },
        responses: {
            201: {
                description: 'File uploaded successfully (new unique file stored)',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message', 'file', 'deduplication'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'File uploaded successfully'
                                },
                                file: {
                                    type: 'object',
                                    required: ['id', 'original_name', 'size', 'mime_type', 'file_hash', 'created_at'],
                                    properties: {
                                        id: {
                                            type: 'string',
                                            format: 'uuid',
                                            example: '6acdccbe-d729-41ca-86a3-9b4d5863cce8',
                                            description: 'Unique file ID'
                                        },
                                        original_name: {
                                            type: 'string',
                                            example: 'photo.jpg',
                                            description: 'Original filename as uploaded'
                                        },
                                        size: {
                                            type: 'number',
                                            example: 2048576,
                                            description: 'File size in bytes'
                                        },
                                        mime_type: {
                                            type: 'string',
                                            example: 'image/jpeg',
                                            description: 'MIME type detected from file'
                                        },
                                        file_hash: {
                                            type: 'string',
                                            example: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                            description: 'SHA256 hash (64 hex characters)'
                                        },
                                        created_at: {
                                            type: 'string',
                                            format: 'date-time',
                                            example: '2026-02-22T12:00:00.000Z'
                                        }
                                    }
                                },
                                deduplication: {
                                    type: 'boolean',
                                    example: false,
                                    description: 'False = new file uploaded, True = linked to existing file'
                                }
                            }
                        },
                        example: {
                            message: 'File uploaded successfully',
                            file: {
                                id: '6acdccbe-d729-41ca-86a3-9b4d5863cce8',
                                original_name: 'photo.jpg',
                                size: 2048576,
                                mime_type: 'image/jpeg',
                                file_hash: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                created_at: '2026-02-22T12:00:00.000Z'
                            },
                            deduplication: false
                        }
                    }
                }
            },
            200: {
                description: 'File already exists - linked instantly via deduplication (no upload occurred)',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'File already exists, linked instantly'
                                },
                                file: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        original_name: { type: 'string' },
                                        size: { type: 'number' },
                                        mime_type: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' }
                                    }
                                },
                                deduplication: {
                                    type: 'boolean',
                                    example: true
                                }
                            }
                        },
                        example: {
                            message: 'File already exists, linked instantly',
                            file: {
                                id: 'xyz-789-abc-123',
                                original_name: 'photo.jpg',
                                size: 2048576,
                                mime_type: 'image/jpeg',
                                created_at: '2026-02-22T12:00:00.000Z'
                            },
                            deduplication: true
                        }
                    }
                }
            },
            400: {
                description: 'No file provided in request',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'No file provided',
                            message: 'Invalid input data'
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required in Authorization header',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Insufficient storage quota - user has exceeded their storage limit',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Insufficient storage. Required: 2 MB, Available: 0.5 MB, Quota: 20 GB',
                            message: 'An error occurred while processing your request'
                        }
                    }
                }
            },
            413: {
                description: 'File too large - maximum 100MB for direct upload',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File too large. Maximum file size is 100MB',
                            message: 'For files larger than 100MB, use chunked upload (/files/upload/init)'
                        }
                    }
                }
            },
            429: {
                description: 'Upload rate limit exceeded - maximum 100 uploads per hour per user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Upload limit exceeded',
                            message: 'You have exceeded the upload limit. Please try again in 1 hour.'
                        }
                    }
                }
            }
        }
    }
},
    '/files/check-duplicate': {
    post: {
        tags: ['Files'],
        summary: 'Pre-upload duplicate detection',
        description: `
**Check if file exists before uploading (saves bandwidth and time).**

**How it works:**
1. Frontend calculates SHA256 hash of file (Web Crypto API)
2. Sends hash + metadata to this endpoint
3. Backend checks if file_hash exists in file_references table
4. If exists: Creates file record for user instantly (deduplication)
5. If not exists: Returns "proceed with upload"

**Benefits:**
- **Saves bandwidth:** No upload if file exists
- **Instant upload:** Duplicate files linked in milliseconds
- **Storage savings:** Same file stored once, referenced by multiple users
- **Better UX:** "100 files uploaded instantly!"

**Use case scenario:**
- User selects 100 files to upload
- Frontend calculates hash for each file
- Calls this endpoint for each file
- 50 files already exist → Linked instantly (no upload)
- 50 files are new → Proceed with upload
- Result: Only 50 files actually uploaded

**Deduplication details:**
- Each user gets their own file record with their filename
- Physical file stored once on disk
- Reference count tracks how many users have the file
- When last user deletes, physical file is removed

**Storage quota:**
- Validated even for duplicates
- File counts against user's quota
- Admin users: unlimited quota
- Regular users: 20GB default

**Frontend implementation:**
\`\`\`javascript
// Calculate hash in browser
const hash = await calculateSHA256(file);

// Check duplicate
const response = await fetch('/api/v1/files/check-duplicate', {
    method: 'POST',
    body: JSON.stringify({
        file_hash: hash,
        file_size: file.size,
        filename: file.name,
        mime_type: file.type,
        folder_id: currentFolderId
    })
});

if (response.exists) {
    // File linked instantly!
    console.log('Instant upload:', response.file);
} else {
    // Proceed with upload
    uploadFile(file);
}
\`\`\`
        `,
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['file_hash', 'file_size', 'filename', 'mime_type'],
                        properties: {
                            file_hash: {
                                type: 'string',
                                pattern: '^[a-f0-9]{64}$',
                                minLength: 64,
                                maxLength: 64,
                                example: 'aa6ab78b132a445ff400d267eb842842c7775aed537e124b8f3df35b98e3ef7d',
                                description: 'SHA256 hash of file (64 hex characters, lowercase). Must be calculated by frontend using Web Crypto API.'
                            },
                            file_size: {
                                type: 'number',
                                minimum: 1,
                                maximum: 107374182400,
                                example: 12227572,
                                description: 'File size in bytes. Maximum 100GB (107374182400 bytes).'
                            },
                            filename: {
                                type: 'string',
                                minLength: 1,
                                maxLength: 255,
                                example: 'vacation_video.mp4',
                                description: 'Original filename. Will be stored as user\'s filename even if file is deduplicated.'
                            },
                            mime_type: {
                                type: 'string',
                                example: 'video/mp4',
                                description: 'MIME type of file (e.g., image/jpeg, video/mp4, application/pdf)'
                            },
                            folder_id: {
                                type: 'string',
                                format: 'uuid',
                                nullable: true,
                                example: '23ed716c-e862-4f91-9972-690634a58f39',
                                description: 'Folder ID to upload to. Null or omit for root directory.'
                            }
                        }
                    },
                    example: {
                        file_hash: 'aa6ab78b132a445ff400d267eb842842c7775aed537e124b8f3df35b98e3ef7d',
                        file_size: 12227572,
                        filename: 'test-file.txt',
                        mime_type: 'text/plain',
                        folder_id: null
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Duplicate check completed',
                content: {
                    'application/json': {
                        schema: {
                            oneOf: [
                                {
                                    type: 'object',
                                    description: 'File already exists - linked to user account instantly',
                                    required: ['exists', 'file', 'message'],
                                    properties: {
                                        exists: {
                                            type: 'boolean',
                                            example: true,
                                            description: 'True = file exists, false = file is unique'
                                        },
                                        file: {
                                            type: 'object',
                                            description: 'File record created for user (linked to existing physical file)',
                                            required: ['id', 'original_name', 'size', 'mime_type', 'created_at'],
                                            properties: {
                                                id: {
                                                    type: 'string',
                                                    format: 'uuid',
                                                    example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                                    description: 'File ID (use this for future operations)'
                                                },
                                                original_name: {
                                                    type: 'string',
                                                    example: 'test-file.txt',
                                                    description: 'Filename as provided by user'
                                                },
                                                size: {
                                                    type: 'number',
                                                    example: 12227572,
                                                    description: 'File size in bytes'
                                                },
                                                mime_type: {
                                                    type: 'string',
                                                    example: 'text/plain'
                                                },
                                                created_at: {
                                                    type: 'string',
                                                    format: 'date-time',
                                                    example: '2026-02-22T07:36:58.596Z'
                                                }
                                            }
                                        },
                                        message: {
                                            type: 'string',
                                            example: 'File already exists, linked to your account instantly',
                                            description: 'Success message indicating instant upload'
                                        }
                                    }
                                },
                                {
                                    type: 'object',
                                    description: 'File is unique - proceed with upload',
                                    required: ['exists', 'message'],
                                    properties: {
                                        exists: {
                                            type: 'boolean',
                                            example: false
                                        },
                                        message: {
                                            type: 'string',
                                            example: 'File is unique, proceed with upload',
                                            description: 'User should now upload the file'
                                        }
                                    }
                                }
                            ]
                        },
                        examples: {
                            'Duplicate found - instant upload': {
                                summary: 'File already exists in system',
                                description: 'File is linked to user account without uploading. Bandwidth and storage saved.',
                                value: {
                                    exists: true,
                                    file: {
                                        id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                        original_name: 'test-file.txt',
                                        size: 12227572,
                                        mime_type: 'text/plain',
                                        created_at: '2026-02-22T07:36:58.596Z'
                                    },
                                    message: 'File already exists, linked to your account instantly'
                                }
                            },
                            'Unique file - proceed with upload': {
                                summary: 'File does not exist in system',
                                description: 'User should proceed with upload (direct or chunked based on size).',
                                value: {
                                    exists: false,
                                    message: 'File is unique, proceed with upload'
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Validation error - invalid request data',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Invalid hash format': {
                                value: {
                                    error: 'Validation failed',
                                    message: 'Invalid input data',
                                    details: [
                                        {
                                            field: 'file_hash',
                                            message: 'File hash must be exactly 64 characters'
                                        }
                                    ]
                                }
                            },
                            'File too large': {
                                value: {
                                    error: 'Validation failed',
                                    message: 'Invalid input data',
                                    details: [
                                        {
                                            field: 'file_size',
                                            message: 'File size cannot exceed 100GB'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Insufficient storage quota - user has exceeded their limit',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Insufficient storage. Required: 11.66 MB, Available: 0 Bytes, Quota: 20 GB',
                            message: 'An error occurred while processing your request'
                        }
                    }
                }
            }
        }
    }
},

'/files/upload/init': {
    post: {
        tags: ['Files'],
        summary: 'Initialize chunked upload for large files',
        description: `
**Initialize upload session for large files (>100MB).**

**How it works:**
1. Frontend calculates SHA256 hash of entire file
2. Splits file into 100MB chunks
3. Calls this endpoint to create upload session
4. Backend creates session in Redis (24-hour TTL)
5. Creates temp directory for chunks
6. Returns session_id for uploading chunks
7. Validates user has sufficient storage quota

**Upload session (stored in Redis):**
- session_id: Unique UUID for this upload
- user_id: Owner of the upload
- filename: Original filename
- file_size: Total file size
- file_hash: SHA256 hash (for verification)
- total_chunks: Number of 100MB chunks
- chunks_received: Array of received chunk indices
- chunks_missing: Array of pending chunk indices
- expires_at: 24 hours from creation
- TTL extends on each chunk upload (resets 24-hour timer)

**Session expiry:**
- Initial TTL: 24 hours
- Extended on activity: Each chunk upload resets timer
- Auto-cleanup: Expired sessions deleted automatically
- Resumable: Can resume within 24 hours of last activity

**Storage quota validation:**
- Checks user has space for entire file
- Admin users: unlimited
- Regular users: 20GB default
- Fails if insufficient space

**Use case:**
- Files > 100MB (large videos, archives, datasets)
- Resumable uploads (network interruptions)
- Progress tracking
- Maximum file size: 100GB

**Next steps after init:**
1. Upload chunks: POST /files/upload/chunk
2. Complete upload: POST /files/upload/complete
3. Or check status: GET /files/upload/status/:session_id
        `,
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['filename', 'file_size', 'file_hash', 'mime_type', 'total_chunks'],
                        properties: {
                            filename: {
                                type: 'string',
                                minLength: 1,
                                maxLength: 255,
                                example: 'large_video.mp4',
                                description: 'Original filename'
                            },
                            file_size: {
                                type: 'number',
                                minimum: 1,
                                maximum: 107374182400,
                                example: 5368709120,
                                description: 'Total file size in bytes (5GB in this example). Maximum 100GB.'
                            },
                            file_hash: {
                                type: 'string',
                                pattern: '^[a-f0-9]{64}$',
                                minLength: 64,
                                maxLength: 64,
                                example: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                description: 'SHA256 hash of entire file (calculated by frontend before chunking)'
                            },
                            mime_type: {
                                type: 'string',
                                example: 'video/mp4',
                                description: 'MIME type of file'
                            },
                            total_chunks: {
                                type: 'number',
                                minimum: 1,
                                maximum: 10000,
                                example: 50,
                                description: 'Number of 100MB chunks. For 5GB file: 50 chunks. Maximum 10,000 chunks.'
                            },
                            folder_id: {
                                type: 'string',
                                format: 'uuid',
                                nullable: true,
                                example: null,
                                description: 'Folder ID to upload to (null = root directory)'
                            }
                        }
                    },
                    examples: {
                        '5GB video (50 chunks)': {
                            value: {
                                filename: 'large_video.mp4',
                                file_size: 5368709120,
                                file_hash: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                mime_type: 'video/mp4',
                                total_chunks: 50,
                                folder_id: null
                            }
                        },
                        '500MB archive (5 chunks)': {
                            value: {
                                filename: 'backup.zip',
                                file_size: 524288000,
                                file_hash: 'def456abc123789def456abc123789def456abc123789def456abc123789abcd',
                                mime_type: 'application/zip',
                                total_chunks: 5,
                                folder_id: '23ed716c-e862-4f91-9972-690634a58f39'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Upload session created successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['upload_session_id', 'chunk_size', 'total_chunks', 'expires_at', 'message'],
                            properties: {
                                upload_session_id: {
                                    type: 'string',
                                    format: 'uuid',
                                    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                    description: 'Session ID - save this for uploading chunks and completing upload'
                                },
                                chunk_size: {
                                    type: 'number',
                                    example: 104857600,
                                    description: 'Chunk size in bytes (100MB = 104857600 bytes)'
                                },
                                total_chunks: {
                                    type: 'number',
                                    example: 50,
                                    description: 'Total number of chunks to upload'
                                },
                                expires_at: {
                                    type: 'string',
                                    format: 'date-time',
                                    example: '2026-02-23T13:00:00.000Z',
                                    description: 'Session expiration time (24 hours from creation, extends on activity)'
                                },
                                message: {
                                    type: 'string',
                                    example: 'Upload session created'
                                }
                            }
                        },
                        example: {
                            upload_session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                            chunk_size: 104857600,
                            total_chunks: 50,
                            expires_at: '2026-02-23T13:00:00.000Z',
                            message: 'Upload session created'
                        }
                    }
                }
            },
            400: {
                description: 'Validation error - invalid request data',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Too many chunks': {
                                value: {
                                    error: 'Validation failed',
                                    message: 'Invalid input data',
                                    details: [
                                        {
                                            field: 'total_chunks',
                                            message: 'Too many chunks (max 10,000)'
                                        }
                                    ]
                                }
                            },
                            'Invalid hash': {
                                value: {
                                    error: 'Validation failed',
                                    message: 'Invalid input data',
                                    details: [
                                        {
                                            field: 'file_hash',
                                            message: 'File hash must be 64 characters'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Insufficient storage quota',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Insufficient storage. Required: 5 GB, Available: 2 GB, Quota: 20 GB',
                            message: 'An error occurred while processing your request'
                        }
                    }
                }
            },
            429: {
                description: 'Upload rate limit exceeded - maximum 100 uploads per hour',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Upload limit exceeded',
                            message: 'You have exceeded the upload limit. Please try again in 1 hour.'
                        }
                    }
                }
            }
        }
    }
},

'/files/upload/chunk': {
    post: {
        tags: ['Files'],
        summary: 'Upload single chunk',
        description: `
**Upload one chunk of a large file.**

**How it works:**
1. Get session_id from /upload/init response
2. Split file into 100MB chunks (Blob.slice())
3. Upload each chunk to this endpoint
4. Chunks can be uploaded in any order
5. Backend saves chunk to temp directory
6. Updates Redis session (marks chunk as received)
7. Extends session TTL (resets 24-hour timer)
8. Returns progress information

**Chunk handling:**
- Saved to: /storage/temp/{session_id}/chunk_{index}
- Stored in memory first (Multer), then written to disk
- Maximum chunk size: 110MB (slightly larger than 100MB for safety)
- Chunks are numbered 0-based (0, 1, 2, ...)

**Resume capability:**
- If chunk already received: Skipped (idempotent)
- Network interruption: Just re-upload missing chunks
- Session persists for 24 hours of inactivity
- Each chunk upload resets the 24-hour timer

**Progress tracking:**
- chunks_received: Array of received chunk indices
- chunks_remaining: Number of chunks still needed
- progress_percentage: Upload completion percentage

**Session TTL extension:**
- Every chunk upload resets 24-hour expiration
- Active uploads never expire
- Abandoned uploads auto-cleanup after 24 hours

**Frontend implementation:**
\`\`\`javascript
// Upload chunk
const formData = new FormData();
formData.append('chunk', chunkBlob);
formData.append('upload_session_id', sessionId);
formData.append('chunk_index', chunkIndex);

const response = await fetch('/api/v1/files/upload/chunk', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
});

// Update progress bar
const progress = response.progress_percentage;
updateProgressBar(progress);
\`\`\`

**Error handling:**
- Session not found: May have expired (24 hours)
- Invalid chunk index: Must be 0 to total_chunks-1
- Chunk too large: Maximum 110MB
- Rate limit: 100 uploads per hour
        `,
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        required: ['upload_session_id', 'chunk_index', 'chunk'],
                        properties: {
                            upload_session_id: {
                                type: 'string',
                                format: 'uuid',
                                example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                description: 'Session ID from /upload/init response'
                            },
                            chunk_index: {
                                type: 'number',
                                minimum: 0,
                                example: 0,
                                description: 'Chunk number (0-based). For 50 chunks: 0 to 49.'
                            },
                            chunk: {
                                type: 'string',
                                format: 'binary',
                                description: 'Chunk file data (max 110MB). Field name must be "chunk".'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Chunk uploaded successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['chunk_index', 'received', 'total_chunks', 'chunks_remaining', 'progress_percentage'],
                            properties: {
                                chunk_index: {
                                    type: 'number',
                                    example: 0,
                                    description: 'Index of chunk just uploaded'
                                },
                                received: {
                                    type: 'number',
                                    example: 1,
                                    description: 'Total number of chunks received so far'
                                },
                                total_chunks: {
                                    type: 'number',
                                    example: 50,
                                    description: 'Total chunks for this upload'
                                },
                                chunks_remaining: {
                                    type: 'number',
                                    example: 49,
                                    description: 'Number of chunks still needed'
                                },
                                progress_percentage: {
                                    type: 'string',
                                    example: '2.00',
                                    description: 'Upload progress as percentage (0.00 to 100.00)'
                                }
                            }
                        },
                        examples: {
                            'First chunk (0/50)': {
                                value: {
                                    chunk_index: 0,
                                    received: 1,
                                    total_chunks: 50,
                                    chunks_remaining: 49,
                                    progress_percentage: '2.00'
                                }
                            },
                            'Middle chunk (25/50)': {
                                value: {
                                    chunk_index: 25,
                                    received: 26,
                                    total_chunks: 50,
                                    chunks_remaining: 24,
                                    progress_percentage: '52.00'
                                }
                            },
                            'Last chunk (49/50)': {
                                value: {
                                    chunk_index: 49,
                                    received: 50,
                                    total_chunks: 50,
                                    chunks_remaining: 0,
                                    progress_percentage: '100.00'
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Invalid chunk or session data',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'No chunk file': {
                                value: {
                                    error: 'No chunk file provided',
                                    message: 'No chunk file provided'
                                }
                            },
                            'Invalid chunk index': {
                                value: {
                                    error: 'Invalid chunk index: 100',
                                    message: 'An error occurred while processing your request'
                                }
                            },
                            'Validation error': {
                                value: {
                                    error: 'Validation failed',
                                    message: 'Invalid input data',
                                    details: [
                                        {
                                            field: 'chunk_index',
                                            message: 'Chunk index must be 0 or greater'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            404: {
                description: 'Upload session not found or expired',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Upload session not found or expired',
                            message: 'Session may have expired after 24 hours of inactivity. Start new upload with /upload/init.'
                        }
                    }
                }
            },
            413: {
                description: 'Chunk too large - maximum 110MB per chunk',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File too large. Maximum chunk size is 110MB',
                            message: 'Split file into smaller chunks (100MB recommended)'
                        }
                    }
                }
            },
            429: {
                description: 'Upload rate limit exceeded - maximum 100 uploads per hour',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
},

'/files/upload/complete': {
    post: {
        tags: ['Files'],
        summary: 'Complete chunked upload',
        description: `
**Finalize chunked upload - assemble, verify, and store file.**

**How it works:**
1. Verify all chunks received (checks Redis session)
2. Assemble chunks into single file (concatenate in order)
3. Calculate SHA256 hash of assembled file
4. Verify hash matches provided hash (detect corruption)
5. Check for duplicates (deduplication)
6. If duplicate: Link to existing file, delete temp files
7. If unique: Move to storage, create file record
8. Update user's storage quota
9. Cleanup temp files and Redis session
10. Log upload activity

**Chunk assembly:**
- Reads chunks from: /storage/temp/{session_id}/chunk_0, chunk_1, ...
- Concatenates in order: chunk_0 + chunk_1 + chunk_2 + ...
- Writes to temp file first
- Verifies hash before moving to final location

**Hash verification:**
- Calculates SHA256 of assembled file
- Compares with hash provided by frontend
- If mismatch: File corrupted during upload (fails)
- If match: Proceeds with storage

**Deduplication (post-upload):**
- Checks if file_hash exists in system
- If exists: Links to existing file, deletes uploaded file
- Saves storage space even after upload
- User still gets file instantly

**File storage:**
- Unique files: Stored at /storage/files/ab/cd/{hash}.{ext}
- Creates file_references entry (reference_count: 1)
- Creates file record in database
- Updates user's storage_used

**Duplicate files:**
- Physical file deleted (already exists)
- Links to existing file_references
- Increments reference_count
- Creates file record for user
- Saves storage space

**Session cleanup:**
- Deletes temp directory with all chunks
- Removes Redis session
- Frees up temp storage

**Activity logging:**
- Logs UPLOAD action
- Tracks deduplication status
- Records storage saved (if deduplicated)

**This endpoint may take time:**
- Large files: 10-30 seconds to assemble
- Hash calculation: Depends on file size
- Frontend should show "Processing..." message
        `,
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['upload_session_id', 'file_hash'],
                        properties: {
                            upload_session_id: {
                                type: 'string',
                                format: 'uuid',
                                example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                description: 'Session ID from /upload/init'
                            },
                            file_hash: {
                                type: 'string',
                                pattern: '^[a-f0-9]{64}$',
                                minLength: 64,
                                maxLength: 64,
                                example: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                description: 'SHA256 hash of original file (for verification)'
                            }
                        }
                    },
                    example: {
                        upload_session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                        file_hash: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd'
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Upload completed successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message', 'file', 'deduplication', 'storage_saved'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Upload completed successfully'
                                },
                                file: {
                                    type: 'object',
                                    required: ['id', 'original_name', 'size', 'mime_type', 'file_hash', 'created_at'],
                                    properties: {
                                        id: {
                                            type: 'string',
                                            format: 'uuid',
                                            example: '6acdccbe-d729-41ca-86a3-9b4d5863cce8',
                                            description: 'File ID'
                                        },
                                        original_name: {
                                            type: 'string',
                                            example: 'large_video.mp4',
                                            description: 'Original filename'
                                        },
                                        size: {
                                            type: 'number',
                                            example: 5368709120,
                                            description: 'File size in bytes (5GB)'
                                        },
                                        mime_type: {
                                            type: 'string',
                                            example: 'video/mp4'
                                        },
                                        file_hash: {
                                            type: 'string',
                                            example: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd'
                                        },
                                        created_at: {
                                            type: 'string',
                                            format: 'date-time',
                                            example: '2026-02-22T13:00:00.000Z'
                                        }
                                    }
                                },
                                deduplication: {
                                    type: 'boolean',
                                    example: false,
                                    description: 'True if file was deduplicated after upload, false if new unique file'
                                },
                                storage_saved: {
                                    type: 'number',
                                    example: 0,
                                    description: 'Bytes saved via deduplication (0 if new file, file_size if deduplicated)'
                                }
                            }
                        },
                        examples: {
                            'New unique file': {
                                summary: 'File stored successfully',
                                value: {
                                    message: 'Upload completed successfully',
                                    file: {
                                        id: '6acdccbe-d729-41ca-86a3-9b4d5863cce8',
                                        original_name: 'large_video.mp4',
                                        size: 5368709120,
                                        mime_type: 'video/mp4',
                                        file_hash: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                        created_at: '2026-02-22T13:00:00.000Z'
                                    },
                                    deduplication: false,
                                    storage_saved: 0
                                }
                            },
                            'Deduplicated file': {
                                summary: 'File already existed - linked after upload',
                                value: {
                                    message: 'Upload completed successfully',
                                    file: {
                                        id: 'xyz-789-abc-123',
                                        original_name: 'large_video.mp4',
                                        size: 5368709120,
                                        mime_type: 'video/mp4',
                                        file_hash: 'abc123def456789abc123def456789abc123def456789abc123def456789abcd',
                                        created_at: '2026-02-22T13:00:00.000Z'
                                    },
                                    deduplication: true,
                                    storage_saved: 5368709120
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Upload incomplete or hash mismatch',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Missing chunks': {
                                value: {
                                    error: 'Upload incomplete. Missing chunks: 3, 4, 7, 8, 9',
                                    message: 'Upload incomplete. Missing chunks: 3, 4, 7, 8, 9'
                                }
                            },
                            'Hash mismatch (corrupted)': {
                                value: {
                                    error: 'File corrupted during upload (hash mismatch)',
                                    message: 'File corrupted during upload (hash mismatch)'
                                }
                            },
                            'Validation error': {
                                value: {
                                    error: 'Validation failed',
                                    message: 'Invalid input data',
                                    details: [
                                        {
                                            field: 'file_hash',
                                            message: 'File hash must be 64 characters'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            404: {
                description: 'Upload session not found or expired',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Upload session not found or expired',
                            message: 'Session expired. Please start new upload.'
                        }
                    }
                }
            }
        }
    }
},

'/files/upload/status/{session_id}': {
    get: {
        tags: ['Files'],
        summary: 'Get upload session status (for resumable uploads)',
        description: `
**Get current status of upload session - used for resuming interrupted uploads.**

**How it works:**
1. Retrieves session from Redis using session_id
2. Returns chunks received and chunks missing
3. Shows upload progress percentage
4. Verifies session belongs to requesting user

**Use cases:**
- **Resume interrupted upload:** Check which chunks are missing
- **Progress monitoring:** Track upload completion
- **Session validation:** Verify session still active
- **Multi-device:** Continue upload from different device

**Resume flow:**
\`\`\`javascript
// User's upload was interrupted
// On page reload or retry:

const response = await fetch(\`/api/v1/files/upload/status/\${sessionId}\`);

if (response.ok) {
    const status = await response.json();
    
    // Resume from missing chunks
    for (const chunkIndex of status.chunks_missing) {
        await uploadChunk(chunkIndex);
    }
} else {
    // Session expired, start new upload
    startNewUpload();
}
\`\`\`

**Session data returned:**
- session_id: Upload session UUID
- filename: Original filename
- total_chunks: Total number of chunks
- chunks_received: Array of received chunk indices [0, 1, 2, 5, 6]
- chunks_missing: Array of pending chunk indices [3, 4, 7, 8, 9]
- progress_percentage: Completion percentage
- expires_at: When session will expire

**Session expiry:**
- 24 hours from last activity
- Extends on each chunk upload
- Expired sessions return 404

**Authorization:**
- Session must belong to requesting user
- Other users cannot access your session
- Returns 403 if unauthorized
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'session_id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                    format: 'uuid'
                },
                example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                description: 'Upload session ID from /upload/init'
            }
        ],
        responses: {
            200: {
                description: 'Upload session status retrieved',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['session_id', 'filename', 'total_chunks', 'chunks_received', 'chunks_missing', 'progress_percentage', 'expires_at'],
                            properties: {
                                session_id: {
                                    type: 'string',
                                    format: 'uuid',
                                    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                    description: 'Session ID'
                                },
                                filename: {
                                    type: 'string',
                                    example: 'large_video.mp4',
                                    description: 'Original filename'
                                },
                                total_chunks: {
                                    type: 'number',
                                    example: 50,
                                    description: 'Total number of chunks for this upload'
                                },
                                chunks_received: {
                                    type: 'array',
                                    items: { type: 'number' },
                                    example: [0, 1, 2, 5, 6, 7, 10, 11, 12],
                                    description: 'Array of chunk indices that have been received (0-based)'
                                },
                                chunks_missing: {
                                    type: 'array',
                                    items: { type: 'number' },
                                    example: [3, 4, 8, 9, 13, 14, 15],
                                    description: 'Array of chunk indices still needed (upload these to resume)'
                                },
                                progress_percentage: {
                                    type: 'string',
                                    example: '18.00',
                                    description: 'Upload progress as percentage (0.00 to 100.00)'
                                },
                                expires_at: {
                                    type: 'string',
                                    format: 'date-time',
                                    example: '2026-02-23T13:00:00.000Z',
                                    description: 'Session expiration time (24 hours from last activity)'
                                }
                            }
                        },
                        examples: {
                            'Partial upload (18% complete)': {
                                summary: '9 of 50 chunks uploaded',
                                value: {
                                    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                    filename: 'large_video.mp4',
                                    total_chunks: 50,
                                    chunks_received: [0, 1, 2, 5, 6, 7, 10, 11, 12],
                                    chunks_missing: [3, 4, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
                                    progress_percentage: '18.00',
                                    expires_at: '2026-02-23T13:00:00.000Z'
                                }
                            },
                            'Almost complete (98% done)': {
                                summary: '49 of 50 chunks uploaded',
                                value: {
                                    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                    filename: 'large_video.mp4',
                                    total_chunks: 50,
                                    chunks_received: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48],
                                    chunks_missing: [49],
                                    progress_percentage: '98.00',
                                    expires_at: '2026-02-23T13:00:00.000Z'
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Unauthorized - session belongs to another user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Unauthorized',
                            message: 'This upload session belongs to another user'
                        }
                    }
                }
            },
            404: {
                description: 'Upload session not found or expired',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Upload session not found or expired',
                            message: 'Session expired after 24 hours of inactivity'
                        }
                    }
                }
            }
        }
    }
},

'/files': {
    get: {
        tags: ['Files'],
        summary: 'List user\'s files',
        description: `
**Get paginated list of user's files.**

**How it works:**
1. Queries files table for current user
2. Filters: is_deleted=false, is_available=true
3. Orders by created_at DESC (newest first)
4. Returns paginated results with metadata

**Filtering:**
- Only shows completed uploads (is_available=true)
- Excludes deleted files (is_deleted=false)
- Excludes files being uploaded (upload_status='uploading')
- User only sees their own files

**Pagination:**
- Default: 50 files per page
- Maximum: 100 files per page
- Returns total count and total pages
- Page numbers start at 1

**Response includes:**
- File ID (for operations)
- Original filename (user's name)
- File size in bytes
- MIME type
- Created timestamp
- Folder ID (null = root)

**Use cases:**
- Display file browser
- Show recent uploads
- Navigate folders
- Search results (future)

**Frontend implementation:**
\`\`\`javascript
// Get first page
const response = await fetch('/api/v1/files?page=1&limit=50');
const data = await response.json();

// Display files
data.files.forEach(file => {
    displayFile(file);
});

// Show pagination
showPagination(data.pagination);
\`\`\`

**Performance:**
- Indexed queries (fast)
- Pagination prevents large result sets
- Sorted by created_at (indexed)
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'page',
                in: 'query',
                required: false,
                schema: {
                    type: 'number',
                    minimum: 1,
                    default: 1
                },
                example: 1,
                description: 'Page number (starts at 1)'
            },
            {
                name: 'limit',
                in: 'query',
                required: false,
                schema: {
                    type: 'number',
                    minimum: 1,
                    maximum: 100,
                    default: 50
                },
                example: 50,
                description: 'Number of files per page (max 100)'
            }
        ],
        responses: {
            200: {
                description: 'Files retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['files', 'pagination'],
                            properties: {
                                files: {
                                    type: 'array',
                                    description: 'Array of file objects',
                                    items: {
                                        type: 'object',
                                        required: ['id', 'original_name', 'size', 'mime_type', 'created_at', 'folder_id'],
                                        properties: {
                                            id: {
                                                type: 'string',
                                                format: 'uuid',
                                                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                                description: 'File ID'
                                            },
                                            original_name: {
                                                type: 'string',
                                                example: 'test-file.txt',
                                                description: 'Original filename'
                                            },
                                            size: {
                                                type: 'string',
                                                example: '12227572',
                                                description: 'File size in bytes (returned as string)'
                                            },
                                            mime_type: {
                                                type: 'string',
                                                example: 'text/plain',
                                                description: 'MIME type'
                                            },
                                            created_at: {
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2026-02-21T21:36:58.596Z',
                                                description: 'Upload timestamp'
                                            },
                                            folder_id: {
                                                type: 'string',
                                                format: 'uuid',
                                                nullable: true,
                                                example: '23ed716c-e862-4f91-9972-690634a58f39',
                                                description: 'Folder ID (null = root directory)'
                                            }
                                        }
                                    }
                                },
                                pagination: {
                                    type: 'object',
                                    required: ['page', 'limit', 'total', 'totalPages'],
                                    properties: {
                                        page: {
                                            type: 'number',
                                            example: 1,
                                            description: 'Current page number'
                                        },
                                        limit: {
                                            type: 'number',
                                            example: 50,
                                            description: 'Files per page'
                                        },
                                        total: {
                                            type: 'number',
                                            example: 150,
                                            description: 'Total number of files'
                                        },
                                        totalPages: {
                                            type: 'number',
                                            example: 3,
                                            description: 'Total number of pages'
                                        }
                                    }
                                }
                            }
                        },
                        examples: {
                            'Page 1 with files': {
                                value: {
                                    files: [
                                        {
                                            id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                            original_name: 'test-file.txt',
                                            size: '12227572',
                                            mime_type: 'text/plain',
                                            created_at: '2026-02-21T21:36:58.596Z',
                                            folder_id: '23ed716c-e862-4f91-9972-690634a58f39'
                                        }
                                    ],
                                    pagination: {
                                        page: 1,
                                        limit: 50,
                                        total: 1,
                                        totalPages: 1
                                    }
                                }
                            },
                            'Empty file list': {
                                value: {
                                    files: [],
                                    pagination: {
                                        page: 1,
                                        limit: 50,
                                        total: 0,
                                        totalPages: 0
                                    }
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
},

'/files/{id}': {
    delete: {
        tags: ['Files'],
        summary: 'Delete file (soft delete - move to trash)',
        description: `
**Move file to trash (soft delete) - can be restored within 30 days.**

**How it works:**
1. Verifies file exists and user owns it
2. Sets is_deleted=true, deleted_at=now
3. Subtracts file size from user's storage_used
4. Logs DELETE activity
5. File remains in database for 30 days
6. Physical file remains on disk (reference counting)

**Soft delete vs permanent delete:**
- **Soft delete (this endpoint):** Moves to trash, can be restored
- **Permanent delete:** Deletes forever, cannot be restored

**Storage quota:**
- Freed immediately when file deleted
- User can upload new files using freed space
- Quota restored if file is restored

**30-day retention:**
- File stays in trash for 30 days
- Can be restored anytime: POST /files/:id/restore
- After 30 days: Background job permanently deletes
- View trash: GET /files/trash

**Reference counting (deduplication):**
- Soft delete: Does NOT affect reference count
- Physical file stays on disk
- Other users' copies unaffected
- Reference count decremented only on permanent delete

**Activity logging:**
- Logs DELETE action
- Records user_id, file_id, timestamp
- Tracks IP address and user agent
- Visible in activity logs

**Authorization:**
- User must own the file
- Cannot delete other users' files
- Returns 403 if not owner
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                    format: 'uuid'
                },
                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                description: 'File ID to delete'
            }
        ],
        responses: {
            200: {
                description: 'File moved to trash successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'File moved to trash',
                                    description: 'Success message'
                                }
                            }
                        },
                        example: {
                            message: 'File moved to trash'
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Unauthorized - user does not own this file',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Unauthorized',
                            message: 'You do not have permission to delete this file'
                        }
                    }
                }
            },
            404: {
                description: 'File not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File not found',
                            message: 'File not found'
                        }
                    }
                }
            }
        }
    }
},
'/files/{id}/restore': {
    post: {
        tags: ['Files'],
        summary: 'Restore file from trash',
        description: `
**Restore soft-deleted file from trash.**

**How it works:**
1. Verifies file exists and user owns it
2. Checks file is in trash (is_deleted=true)
3. Sets is_deleted=false, deleted_at=null
4. Adds file size back to user's storage_used
5. Logs RESTORE activity
6. File becomes available again

**Requirements:**
- File must be in trash (is_deleted=true)
- User must own the file
- File must not be permanently deleted yet
- User must have storage quota available

**Storage quota:**
- File size added back to user's storage_used
- Validates user has available space
- Fails if quota exceeded
- Admin users: unlimited quota

**Restoration:**
- File becomes visible in file list again
- All metadata preserved (filename, folder, etc.)
- File hash and physical file unchanged
- Created timestamp unchanged

**Activity logging:**
- Logs RESTORE action
- Records user_id, file_id, timestamp
- Tracks IP address and user agent

**Authorization:**
- User must own the file
- Cannot restore other users' files
- Returns 403 if not owner

**Error cases:**
- File not in trash: Returns 400
- File not found: Returns 404
- Not file owner: Returns 403
- Quota exceeded: Returns 403
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                    format: 'uuid'
                },
                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                description: 'File ID to restore (get from /files/trash)'
            }
        ],
        responses: {
            200: {
                description: 'File restored from trash successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'File restored from trash',
                                    description: 'Success message'
                                }
                            }
                        },
                        example: {
                            message: 'File restored from trash'
                        }
                    }
                }
            },
            400: {
                description: 'File is not in trash',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File is not in trash',
                            message: 'File is not in trash'
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Unauthorized - user does not own this file or quota exceeded',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Not owner': {
                                value: {
                                    error: 'Unauthorized',
                                    message: 'You do not have permission to restore this file'
                                }
                            },
                            'Quota exceeded': {
                                value: {
                                    error: 'Insufficient storage. Required: 11.66 MB, Available: 0 Bytes, Quota: 20 GB',
                                    message: 'An error occurred while processing your request'
                                }
                            }
                        }
                    }
                }
            },
            404: {
                description: 'File not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File not found',
                            message: 'File not found'
                        }
                    }
                }
            }
        }
    }
},

'/files/{id}/permanent': {
    delete: {
        tags: ['Files'],
        summary: 'Permanently delete file (cannot be undone)',
        description: `
**Permanently delete file immediately - bypasses trash, cannot be restored.**

**How it works:**
1. Verifies file exists and user owns it
2. Logs DELETE activity (permanent=true)
3. Decrements reference count in file_references
4. If reference_count reaches 0: Deletes physical file from disk
5. If reference_count > 0: Keeps physical file (other users need it)
6. Deletes file record from database
7. File is gone forever (cannot be restored)

**Reference counting (deduplication):**
- Decrements reference_count in file_references table
- If count = 0: Physical file deleted from /storage/files/
- If count > 0: Physical file kept (other users still have it)
- Example: File shared by 3 users, 1 deletes → count: 3→2, file kept

**Physical file deletion:**
- Only deleted when reference_count reaches 0
- Deletes from: /storage/files/ab/cd/{hash}.{ext}
- Also deletes thumbnail if exists
- Frees actual disk space

**Difference from soft delete:**
- **Soft delete:** Moves to trash, can restore, 30-day retention
- **Permanent delete:** Immediate, cannot restore, bypasses trash

**Use cases:**
- User wants immediate deletion (not wait 30 days)
- Sensitive file that must be removed now
- Free up storage immediately
- Mistake correction (uploaded wrong file)

**Warning:**
- This action cannot be undone
- File is permanently deleted
- Frontend should show confirmation dialog
- Recommended: Double confirmation for this action

**Activity logging:**
- Logs DELETE action with permanent=true flag
- Records filename in details
- Tracks IP address and user agent
- Distinguishes from soft delete in logs

**Authorization:**
- User must own the file
- Cannot delete other users' files
- Returns 403 if not owner

**Storage quota:**
- Already freed on soft delete
- No quota change on permanent delete
- Physical space freed only if reference_count=0
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                    format: 'uuid'
                },
                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                description: 'File ID to permanently delete'
            }
        ],
        responses: {
            200: {
                description: 'File permanently deleted',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'File permanently deleted',
                                    description: 'Success message - file is gone forever'
                                }
                            }
                        },
                        example: {
                            message: 'File permanently deleted'
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Unauthorized - user does not own this file',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Unauthorized',
                            message: 'You do not have permission to delete this file'
                        }
                    }
                }
            },
            404: {
                description: 'File not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File not found',
                            message: 'File not found'
                        }
                    }
                }
            }
        }
    }
},

'/files/trash': {
    get: {
        tags: ['Files'],
        summary: 'Get trashed files',
        description: `
**Get paginated list of user's deleted files (trash bin).**

**How it works:**
1. Queries files table for current user
2. Filters: is_deleted=true
3. Orders by deleted_at DESC (most recently deleted first)
4. Returns paginated results with deletion info
5. Calculates days until permanent deletion (30-day retention)

**Trash retention:**
- Files stay in trash for 30 days
- After 30 days: Permanently deleted by background job
- Can be restored anytime within 30 days
- Storage quota freed immediately on delete

**Days until permanent delete:**
- Calculated as: 30 - days_since_deletion
- Example: Deleted 5 days ago = 25 days remaining
- When 0: File will be permanently deleted soon

**Pagination:**
- Default: 50 files per page
- Maximum: 100 files per page
- Sorted by deleted_at (newest deletions first)

**Response includes:**
- File ID (for restore operation)
- Original filename
- File size
- MIME type
- Deletion timestamp
- Folder ID
- Days until permanent deletion

**Use cases:**
- View deleted files
- Restore accidentally deleted files
- Check what will be permanently deleted soon
- Trash management UI

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/files/trash?page=1');
const data = await response.json();

data.files.forEach(file => {
    console.log(\`\${file.original_name} - \${file.days_until_permanent_delete} days left\`);
    
    if (file.days_until_permanent_delete < 7) {
        showWarning('Will be permanently deleted soon!');
    }
});
\`\`\`

**Permanent deletion:**
- Automatic: Background job runs daily at 2 AM
- Manual: User can permanently delete via /files/:id/permanent
- Reference counting: Physical file deleted only if no other users have it
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'page',
                in: 'query',
                required: false,
                schema: {
                    type: 'number',
                    minimum: 1,
                    default: 1
                },
                example: 1,
                description: 'Page number'
            },
            {
                name: 'limit',
                in: 'query',
                required: false,
                schema: {
                    type: 'number',
                    minimum: 1,
                    maximum: 100,
                    default: 50
                },
                example: 50,
                description: 'Files per page (max 100)'
            }
        ],
        responses: {
            200: {
                description: 'Trashed files retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['files', 'pagination'],
                            properties: {
                                files: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        required: ['id', 'original_name', 'size', 'mime_type', 'deleted_at', 'folder_id', 'days_until_permanent_delete'],
                                        properties: {
                                            id: {
                                                type: 'string',
                                                format: 'uuid',
                                                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                                description: 'File ID (use for restore)'
                                            },
                                            original_name: {
                                                type: 'string',
                                                example: 'deleted_file.txt'
                                            },
                                            size: {
                                                type: 'string',
                                                example: '12227572',
                                                description: 'File size in bytes'
                                            },
                                            mime_type: {
                                                type: 'string',
                                                example: 'text/plain'
                                            },
                                            deleted_at: {
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2026-02-20T10:00:00.000Z',
                                                description: 'When file was deleted'
                                            },
                                            folder_id: {
                                                type: 'string',
                                                format: 'uuid',
                                                nullable: true,
                                                example: null
                                            },
                                            days_until_permanent_delete: {
                                                type: 'number',
                                                minimum: 0,
                                                maximum: 30,
                                                example: 25,
                                                description: 'Days remaining before permanent deletion (0 = will be deleted soon)'
                                            }
                                        }
                                    }
                                },
                                pagination: {
                                    type: 'object',
                                    properties: {
                                        page: { type: 'number', example: 1 },
                                        limit: { type: 'number', example: 50 },
                                        total: { type: 'number', example: 5 },
                                        totalPages: { type: 'number', example: 1 }
                                    }
                                }
                            }
                        },
                        examples: {
                            'Trash with files': {
                                value: {
                                    files: [
                                        {
                                            id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                            original_name: 'old_document.pdf',
                                            size: '2048576',
                                            mime_type: 'application/pdf',
                                            deleted_at: '2026-02-20T10:00:00.000Z',
                                            folder_id: null,
                                            days_until_permanent_delete: 25
                                        }
                                    ],
                                    pagination: {
                                        page: 1,
                                        limit: 50,
                                        total: 1,
                                        totalPages: 1
                                    }
                                }
                            },
                            'Empty trash': {
                                value: {
                                    files: [],
                                    pagination: {
                                        page: 1,
                                        limit: 50,
                                        total: 0,
                                        totalPages: 0
                                    }
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            }
        }
    }
},
'/files/{id}/download': {
    get: {
        tags: ['Files'],
        summary: 'Download file',
        description: `
**Download file with proper streaming and headers.**

**How it works:**
1. Verifies file exists and user owns it
2. Checks file is not deleted (not in trash)
3. Checks file is available (upload completed)
4. Verifies physical file exists on disk
5. Logs DOWNLOAD activity
6. Streams file to user with proper headers
7. Sets Content-Disposition header (attachment)

**File streaming:**
- Uses Express res.download() method
- Sets proper Content-Type header (based on MIME type)
- Sets Content-Disposition: attachment; filename="..."
- Supports large files (streams, doesn't load in memory)
- Browser triggers download dialog

**Authorization:**
- User must own the file
- Cannot download other users' files
- Returns 403 if not owner

**File validation:**
- File must not be deleted (is_deleted=false)
- File must be available (is_available=true)
- Upload must be complete (upload_status='completed')
- Physical file must exist on disk

**Activity logging:**
- Logs DOWNLOAD action
- Records filename and size
- Tracks IP address and user agent
- Visible in activity logs

**Error handling:**
- File in trash: Returns 404
- Upload incomplete: Returns 400
- Physical file missing: Returns 500 (data corruption)
- Not owner: Returns 403

**Use cases:**
- Download files from web interface
- Download via API/CLI
- Backup files locally
- Share with external apps

**Frontend implementation:**
\`\`\`javascript
// Download file
const response = await fetch(\`/api/v1/files/\${fileId}/download\`, {
    headers: { 'Authorization': 'Bearer ' + token }
});

// Browser automatically downloads
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
\`\`\`

**Rate limiting:**
- 200 downloads per hour per user
- Prevents abuse
- Separate from upload rate limit
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                    format: 'uuid'
                },
                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                description: 'File ID to download'
            }
        ],
        responses: {
            200: {
                description: 'File download started',
                content: {
                    'application/octet-stream': {
                        schema: {
                            type: 'string',
                            format: 'binary',
                            description: 'File binary data'
                        }
                    }
                },
                headers: {
                    'Content-Disposition': {
                        schema: { type: 'string' },
                        description: 'attachment; filename="test-file.txt"',
                        example: 'attachment; filename="vacation_video.mp4"'
                    },
                    'Content-Type': {
                        schema: { type: 'string' },
                        description: 'File MIME type',
                        example: 'video/mp4'
                    },
                    'Content-Length': {
                        schema: { type: 'number' },
                        description: 'File size in bytes',
                        example: 12227572
                    }
                }
            },
            400: {
                description: 'File is not available (upload incomplete)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File is not available (upload may be incomplete)',
                            message: 'File is not available (upload may be incomplete)'
                        }
                    }
                }
            },
            401: {
                description: 'Not authenticated - JWT token required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            403: {
                description: 'Unauthorized - user does not own this file',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Unauthorized',
                            message: 'You do not have permission to download this file'
                        }
                    }
                }
            },
            404: {
                description: 'File not found or in trash',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Not found': {
                                value: {
                                    error: 'File not found',
                                    message: 'File not found'
                                }
                            },
                            'In trash': {
                                value: {
                                    error: 'File is in trash',
                                    message: 'File is in trash'
                                }
                            }
                        }
                    }
                }
            },
            429: {
                description: 'Download rate limit exceeded - maximum 200 downloads per hour',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Download limit exceeded',
                            message: 'You have exceeded the download limit. Please try again in 1 hour.'
                        }
                    }
                }
            },
            500: {
                description: 'Physical file not found on disk (data corruption)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'File not found on disk',
                            message: 'Internal server error - file data may be corrupted'
                        }
                    }
                }
            }
        }
    }
},
'/files/{id}/thumbnail': {
    get: {
        tags: ['Files'],
        summary: 'Get file thumbnail',
        description: `
**Get thumbnail image for a file.**

**How it works:**
1. Checks if file exists and user owns it
2. Verifies thumbnail has been generated
3. Streams thumbnail as JPEG image
4. Caches for 1 year for performance

**Thumbnail specs:**
- Size: 200x200px (maintains aspect ratio)
- Format: JPEG (80% quality)
- Generated automatically after upload
- Supported: images and videos

**Supported file types:**
- Images: .jpg, .jpeg, .png, .gif, .webp, .bmp, .svg
- Videos: .mp4, .mov, .avi, .mkv, .webm, .flv

**For videos:**
- Extracts frame at 1 second using FFmpeg
- Resized to 200x200px

**Use cases:**
- Display file previews in UI
- Grid view thumbnails
- Quick visual identification

**Frontend implementation:**
\`\`\`javascript
<img src={\`/api/v1/files/\${fileId}/thumbnail\`} alt="thumbnail" />
\`\`\`
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'File ID'
            }
        ],
        responses: {
            200: {
                description: 'Thumbnail image',
                content: {
                    'image/jpeg': {
                        schema: {
                            type: 'string',
                            format: 'binary'
                        }
                    }
                },
                headers: {
                    'Content-Type': {
                        schema: { type: 'string', example: 'image/jpeg' }
                    },
                    'Cache-Control': {
                        schema: { type: 'string', example: 'public, max-age=31536000' }
                    }
                }
            },
            401: { description: 'Not authenticated' },
            403: { description: 'Unauthorized - not file owner' },
            404: {
                description: 'File not found or thumbnail not available',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'File not found': {
                                value: { error: 'File not found' }
                            },
                            'No thumbnail': {
                                value: { error: 'Thumbnail not available for this file' }
                            },
                            'Thumbnail missing': {
                                value: { error: 'Thumbnail file not found' }
                            }
                        }
                    }
                }
            }
        }
    }
},
'/files/{id}/move': {
    put: {
        tags: ['Files'],
        summary: 'Move file to different folder',
        description: `
**Move file to a different folder or root directory.**

**How it works:**
1. Verifies file exists and user owns it
2. Validates target folder exists and user owns it
3. Checks file is not deleted
4. Checks target folder is not deleted
5. Updates file's folder_id
6. Logs MOVE_FILE activity

**Moving to root:**
- Set folder_id to null
- File moves to root directory
- No parent folder

**Moving to folder:**
- Set folder_id to target folder UUID
- File moves to that folder
- Folder must exist and belong to user

**Validation:**
- File must not be deleted
- Target folder must not be deleted
- User must own both file and target folder
- Target folder must exist (if not null)

**Activity logging:**
- Logs MOVE_FILE action
- Records filename and target_folder_id
- Tracks IP and user agent

**Use cases:**
- Reorganize files
- Move files to new folders
- Move files to root
- Clean up file structure

**Frontend implementation:**
\`\`\`javascript
// Move file to folder
await fetch(\`/api/v1/files/\${fileId}/move\`, {
    method: 'PUT',
    body: JSON.stringify({
        folder_id: 'target-folder-uuid'
    })
});

// Move file to root
await fetch(\`/api/v1/files/\${fileId}/move\`, {
    method: 'PUT',
    body: JSON.stringify({
        folder_id: null
    })
});
\`\`\`

**Authorization:**
- User must own the file
- User must own target folder (if specified)
- Cannot move other users' files
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                    format: 'uuid'
                },
                example: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                description: 'File ID to move'
            }
        ],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['folder_id'],
                        properties: {
                            folder_id: {
                                type: 'string',
                                format: 'uuid',
                                nullable: true,
                                example: '23ed716c-e862-4f91-9972-690634a58f39',
                                description: 'Target folder ID (null = move to root)'
                            }
                        }
                    },
                    examples: {
                        'Move to folder': {
                            value: {
                                folder_id: '23ed716c-e862-4f91-9972-690634a58f39'
                            }
                        },
                        'Move to root': {
                            value: {
                                folder_id: null
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'File moved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message', 'file'],
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'File moved successfully'
                                },
                                file: {
                                    type: 'object',
                                    required: ['id', 'original_name', 'folder_id'],
                                    properties: {
                                        id: {
                                            type: 'string',
                                            format: 'uuid',
                                            example: '112a0abe-7012-49e2-8dc2-70abe96de52f'
                                        },
                                        original_name: {
                                            type: 'string',
                                            example: 'test-file.txt'
                                        },
                                        folder_id: {
                                            type: 'string',
                                            format: 'uuid',
                                            nullable: true,
                                            example: '23ed716c-e862-4f91-9972-690634a58f39',
                                            description: 'New folder ID (null = root)'
                                        }
                                    }
                                }
                            }
                        },
                        examples: {
                            'Moved to folder': {
                                value: {
                                    message: 'File moved successfully',
                                    file: {
                                        id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                        original_name: 'test-file.txt',
                                        folder_id: '23ed716c-e862-4f91-9972-690634a58f39'
                                    }
                                }
                            },
                            'Moved to root': {
                                value: {
                                    message: 'File moved successfully',
                                    file: {
                                        id: '112a0abe-7012-49e2-8dc2-70abe96de52f',
                                        original_name: 'test-file.txt',
                                        folder_id: null
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Invalid operation',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Deleted file': {
                                value: {
                                    error: 'Cannot move deleted file',
                                    message: 'Cannot move deleted file'
                                }
                            },
                            'Deleted folder': {
                                value: {
                                    error: 'Cannot move to deleted folder',
                                    message: 'Cannot move to deleted folder'
                                }
                            }
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
            403: {
                description: 'Unauthorized',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Not file owner': {
                                value: {
                                    error: 'Unauthorized',
                                    message: 'Unauthorized'
                                }
                            },
                            'Not folder owner': {
                                value: {
                                    error: 'Unauthorized - target folder belongs to another user',
                                    message: 'Unauthorized - target folder belongs to another user'
                                }
                            }
                        }
                    }
                }
            },
            404: {
                description: 'File or target folder not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'File not found': {
                                value: {
                                    error: 'File not found',
                                    message: 'File not found'
                                }
                            },
                            'Folder not found': {
                                value: {
                                    error: 'Target folder not found',
                                    message: 'Target folder not found'
                                }
                            }
                        }
                    }
                }
            }
        }
    }
},
};


