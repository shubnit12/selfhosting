export const userPaths = {
    '/users': {
        get: {
            tags: ['Users'],
            summary: 'List all users (Admin only)',
            description: `
**Get paginated list of all users with storage statistics.**

**Admin only endpoint** - requires admin role.

**Returns:**
- User ID, username, email, role
- Storage used and quota
- 2FA status
- Created/updated timestamps
- Pagination metadata

**Use cases:**
- Admin dashboard user list
- Monitor storage usage across users
- Identify users approaching quota limits

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/users?page=1&limit=50', {
    headers: {
        'Authorization': 'Bearer ' + adminToken
    }
});
const { users, pagination } = await response.json();
\`\`\`
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'page',
                    in: 'query',
                    schema: { type: 'integer', default: 1 },
                    description: 'Page number'
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 50 },
                    description: 'Users per page'
                }
            ],
            responses: {
                200: {
                    description: 'Users retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    users: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                username: { type: 'string' },
                                                email: { type: 'string' },
                                                role: { type: 'string', enum: ['user', 'admin'] },
                                                storage_used: { type: 'number' },
                                                storage_quota: { type: 'number', nullable: true },
                                                two_fa_enabled: { type: 'boolean' },
                                                created_at: { type: 'string', format: 'date-time' },
                                                updated_at: { type: 'string', format: 'date-time' }
                                            }
                                        }
                                    },
                                    pagination: {
                                        type: 'object',
                                        properties: {
                                            total: { type: 'number' },
                                            page: { type: 'number' },
                                            limit: { type: 'number' },
                                            totalPages: { type: 'number' }
                                        }
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
                    description: 'Not an admin',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                }
            }
        }
    },

    '/users/{id}': {
        get: {
            tags: ['Users'],
            summary: 'Get user details (Admin only)',
            description: `
**Get detailed information about a specific user.**

**Admin only endpoint** - requires admin role.

**Returns:**
- All user fields
- Storage percentage calculated
- Detailed quota information

**Use cases:**
- View user profile in admin panel
- Check storage usage details
- Verify user settings
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', format: 'uuid' },
                    description: 'User ID'
                }
            ],
            responses: {
                200: {
                    description: 'User retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    user: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', format: 'uuid' },
                                            username: { type: 'string' },
                                            email: { type: 'string' },
                                            role: { type: 'string' },
                                            storage_used: { type: 'number' },
                                            storage_quota: { type: 'number', nullable: true },
                                            two_fa_enabled: { type: 'boolean' },
                                            created_at: { type: 'string', format: 'date-time' },
                                            updated_at: { type: 'string', format: 'date-time' },
                                            storage_percentage: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                401: { description: 'Not authenticated' },
                403: { description: 'Not an admin' },
                404: { description: 'User not found' }
            }
        },

        delete: {
            tags: ['Users'],
            summary: 'Delete user (Admin only) - NOT IMPLEMENTED',
            description: `
**Delete a user account (soft delete).**

**Admin only endpoint** - requires admin role.

**Restrictions:**
- Cannot delete your own account
- Cannot delete other admin accounts
- Currently returns 501 Not Implemented

**Future implementation:**
- Will soft delete user
- Mark as inactive
- Preserve data for audit
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', format: 'uuid' }
                }
            ],
            responses: {
                200: { description: 'User deleted (not implemented)' },
                400: { description: 'Cannot delete own account' },
                403: { description: 'Cannot delete admin users' },
                404: { description: 'User not found' },
                501: { description: 'Not implemented yet' }
            }
        }
    },

    '/users/{id}/quota': {
        put: {
            tags: ['Users'],
            summary: 'Update user storage quota (Admin only)',
            description: `
**Update a user's storage quota.**

**Admin only endpoint** - requires admin role.

**Validation:**
- Quota cannot be negative
- Quota cannot be less than current usage
- Set to null for unlimited storage

**Use cases:**
- Increase user quota
- Set unlimited storage (null)
- Adjust quota based on plan

**Frontend implementation:**
\`\`\`javascript
// Set to 50GB
await fetch('/api/v1/users/user-id/quota', {
    method: 'PUT',
    headers: {
        'Authorization': 'Bearer ' + adminToken,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        storage_quota: 50 * 1024 * 1024 * 1024
    })
});

// Set unlimited
await fetch('/api/v1/users/user-id/quota', {
    method: 'PUT',
    body: JSON.stringify({ storage_quota: null })
});
\`\`\`
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', format: 'uuid' }
                }
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['storage_quota'],
                            properties: {
                                storage_quota: {
                                    type: 'number',
                                    nullable: true,
                                    description: 'New quota in bytes (null = unlimited)'
                                }
                            }
                        },
                        examples: {
                            '50GB': {
                                value: { storage_quota: 53687091200 }
                            },
                            'Unlimited': {
                                value: { storage_quota: null }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Quota updated successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' },
                                    user: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            username: { type: 'string' },
                                            storage_quota: { type: 'number', nullable: true },
                                            storage_used: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                400: {
                    description: 'Invalid quota value',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            examples: {
                                'Negative quota': {
                                    value: { error: 'Quota cannot be negative' }
                                },
                                'Below usage': {
                                    value: { error: 'Quota cannot be less than current usage (1234567 bytes)' }
                                }
                            }
                        }
                    }
                },
                401: { description: 'Not authenticated' },
                403: { description: 'Not an admin' },
                404: { description: 'User not found' }
            }
        }
    },
    '/users/{id}/restore': {
        post: {
        tags: ['Users'],
        summary: 'Restore deactivated user (Admin only)',
        description: `
**Restore a soft-deleted user account.**
 
**Admin only endpoint** - requires admin role.
 
**How it works:**
1. Checks if user exists
2. Verifies user is actually deactivated
3. Sets is_active = true
4. Clears deleted_at timestamp
5. User can login again
 
**Validation:**
- User must exist
- User must be deactivated (is_active = false)
- Cannot restore already active users
 
**Use cases:**
- Undo accidental deletion
- Reactivate user account
- Restore after suspension period
 
**Frontend implementation:**
\`\`\`javascript
await fetch('/api/v1/users/user-id/restore', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + adminToken
    }
});
\`\`\`
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'User ID to restore'
            }
        ],
        responses: {
            200: {
                description: 'User restored successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { 
                                    type: 'string',
                                    example: 'User restored successfully'
                                },
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        username: { type: 'string' },
                                        email: { type: 'string' },
                                        is_active: { 
                                            type: 'boolean',
                                            example: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'User is already active',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'User is already active'
                        }
                    }
                }
            },
            401: { description: 'Not authenticated' },
            403: { description: 'Not an admin' },
            404: { description: 'User not found' }
        }
        }
    },
    '/users/{id}/permanent': {
    delete: {
        tags: ['Users'],
        summary: 'Permanently delete user and all data (Admin only)',
        description: `
**Permanently delete a user and ALL associated data.**

**⚠️ WARNING: This is IRREVERSIBLE!**

**Admin only endpoint** - requires admin role.

**What gets deleted:**
1. **Share Links** - All user's share links deactivated
2. **Files** - Handles deduplication:
   - Unique files: Physical file deleted from disk
   - Shared files: Reference count decremented, file kept for other users
3. **Folders** - All user's folders deleted
4. **Activity Logs** - User ID anonymized (set to null, logs preserved for audit)
5. **User Account** - User record deleted from database

**Restrictions:**
- Cannot delete admin users
- Cannot delete your own account
- Must pass \`confirm: true\` in request body

**Transaction safety:**
- Entire operation wrapped in database transaction
- If any step fails, everything rolls back
- No partial deletions

**Returns statistics:**
- Files deleted count
- Folders deleted count
- Storage freed (bytes)
- Share links deactivated count

**Use cases:**
- Permanent account removal
- GDPR compliance (right to be forgotten)
- Free up storage immediately
- Manual cleanup instead of waiting 30 days

**Frontend implementation:**
\`\`\`javascript
// Must pass confirm: true
await fetch('/api/v1/users/user-id/permanent', {
    method: 'DELETE',
    headers: {
        'Authorization': 'Bearer ' + adminToken,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        confirm: true
    })
});
\`\`\`
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'User ID to permanently delete'
            }
        ],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['confirm'],
                        properties: {
                            confirm: {
                                type: 'boolean',
                                description: 'Must be true to confirm permanent deletion',
                                example: true
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'User permanently deleted',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { 
                                    type: 'string',
                                    example: 'User permanently deleted'
                                },
                                stats: {
                                    type: 'object',
                                    properties: {
                                        files_deleted: { type: 'number', example: 42 },
                                        folders_deleted: { type: 'number', example: 5 },
                                        storage_freed: { type: 'number', example: 1073741824, description: 'Bytes freed' },
                                        share_links_deactivated: { type: 'number', example: 3 }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Invalid request',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'No confirmation': {
                                value: { error: 'Must confirm permanent deletion by setting confirm: true' }
                            },
                            'Self deletion': {
                                value: { error: 'Cannot delete your own account' }
                            }
                        }
                    }
                }
            },
            401: { description: 'Not authenticated' },
            403: {
                description: 'Forbidden',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'Not admin': {
                                value: { error: 'Admin access required' }
                            },
                            'Admin user': {
                                value: { error: 'Cannot permanently delete admin users' }
                            }
                        }
                    }
                }
            },
            404: { description: 'User not found' }
        }
    }
},
'/users/cleanup': {
    post: {
        tags: ['Users'],
        summary: 'Manually trigger cleanup tasks (Admin only)',
        description: `
**Manually trigger all orphaned files cleanup tasks.**

**Admin only endpoint** - requires admin role.

**What gets cleaned up:**

**1. Orphaned File References:**
- File references with reference_count = 0
- Physical files exist but no File records point to them
- Deletes physical file + reference record
- Frees storage space

**2. Expired Upload Sessions:**
- Upload sessions older than 7 days in Redis
- Incomplete chunked uploads
- Deletes temp chunks from disk
- Removes Redis session entries

**3. Orphaned Thumbnails:**
- Thumbnails exist but original file deleted
- Scans /storage/thumbnails/ directory
- Checks if File record exists for each thumbnail
- Deletes orphaned thumbnail files

**4. Unreferenced Physical Files:**
- Physical files on disk with no database reference
- Scans /storage/files/ directory recursively
- Checks if file_reference exists for each file
- Deletes files with no database record
- Handles crash/error scenarios

**5. Trashed Files (30+ days):**
- Files in trash for more than 30 days
- Permanently deletes files (handles deduplication)
- Frees storage space
- Auto-cleanup of old trash items

**6. Trashed Folders (30+ days):**
- Folders in trash for more than 30 days
- Permanently deletes folder records
- Cascade cleanup

**7. Inactive Users (30+ days):**
- Users deactivated for more than 30 days
- Calls hardDeleteUser() for each
- Deletes all user data (files, folders, share links)
- Complete account removal

**8. Missing Thumbnails:**
- Finds image/video files without thumbnails
- Queues thumbnail generation jobs
- Processes max 100 files per run
- Catches failed/missed thumbnail generation

**Scheduled execution:**
- Auto-runs daily at 3 AM via cron job
- This endpoint allows manual trigger for testing/maintenance

**Returns statistics:**
- Files deleted count
- Storage freed (bytes)
- Sessions deleted count
- Chunks deleted count
- Thumbnails deleted count

**Use cases:**
- Manual maintenance
- Test cleanup logic
- Immediate cleanup instead of waiting for scheduled job
- Free storage on demand

**Frontend implementation:**
\`\`\`javascript
await fetch('/api/v1/users/cleanup', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + adminToken
    }
});
\`\`\`

**Performance:**
- Safe to run anytime
- Scans entire storage directory
- May take 1-5 minutes for large datasets
- Runs in background, doesn't block API
        `,
        security: [{ bearerAuth: [] }],
        responses: {
            200: {
                description: 'Cleanup tasks completed',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Cleanup tasks completed'
                                },
                                results: {
                                    type: 'object',
                                    properties: {
                                        orphanedFiles: {
                                            type: 'object',
                                            properties: {
                                                filesDeleted: { type: 'number', example: 5 },
                                                storageFreed: { type: 'number', example: 1048576 }
                                            }
                                        },
                                        expiredSessions: {
                                            type: 'object',
                                            properties: {
                                                sessionsDeleted: { type: 'number', example: 2 },
                                                chunksDeleted: { type: 'number', example: 150 }
                                            }
                                        },
                                        orphanedThumbnails: {
                                            type: 'object',
                                            properties: {
                                                thumbnailsDeleted: { type: 'number', example: 3 }
                                            }
                                        },
                                        unreferencedFiles: {
                                            type: 'object',
                                            properties: {
                                                filesDeleted: { type: 'number', example: 2 },
                                                storageFreed: { type: 'number', example: 524288 }
                                            }
                                        },
                                        
trashedFiles: {
    type: 'object',
    properties: {
        filesDeleted: { type: 'number', example: 10 },
        storageFreed: { type: 'number', example: 5242880 }
    }
},
trashedFolders: {
    type: 'object',
    properties: {
        foldersDeleted: { type: 'number', example: 3 }
    }
},
inactiveUsers: {
    type: 'object',
    properties: {
        usersDeleted: { type: 'number', example: 1 },
        filesDeleted: { type: 'number', example: 50 },
        foldersDeleted: { type: 'number', example: 5 },
        storageFreed: { type: 'number', example: 10485760 }
    }
},
missingThumbnails: {
    type: 'object',
    properties: {
        jobsQueued: { type: 'number', example: 15 }
    }
}
                                    }
                                }
                            }
                        },
                        example: {
                            message: 'Cleanup tasks completed',
                            results: {
                                orphanedFiles: {
                                    filesDeleted: 5,
                                    storageFreed: 1048576
                                },
                                expiredSessions: {
                                    sessionsDeleted: 2,
                                    chunksDeleted: 150
                                },
                                orphanedThumbnails: {
                                    thumbnailsDeleted: 3
                                },
        unreferencedFiles: {
            filesDeleted: 2,
            storageFreed: 524288
        },
        trashedFiles: { filesDeleted: 10, storageFreed: 5242880 },
        trashedFolders: { foldersDeleted: 3 },
        inactiveUsers: { 
            usersDeleted: 1, 
            filesDeleted: 50, 
            foldersDeleted: 5, 
            storageFreed: 10485760 
        },
        missingThumbnails: { jobsQueued: 15 }
                            }
                        }
                    }
                }
            },
            401: { description: 'Not authenticated' },
            403: { description: 'Not an admin' }
        }
    }
},
'/users/me': {
    get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        description: `
**Get the currently authenticated user's profile with live storage stats.**

**Available to any authenticated user** - not admin-only.

**Returns:**
- User ID, username, email, role
- Storage used and quota
- Storage percentage (calculated)
- 2FA status
- Account status (is_active)
- Created/updated timestamps

**Use cases:**
- Display user profile in settings
- Show storage usage in dashboard
- Check account status
- Verify current user info

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/users/me', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});
const { user } = await response.json();
console.log(\`Storage: \${user.storage_percentage}%\`);
\`\`\`
        `,
        security: [{ bearerAuth: [] }],
        responses: {
            200: {
                description: 'Current user profile',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        username: { type: 'string' },
                                        email: { type: 'string' },
                                        role: { type: 'string', enum: ['user', 'admin'] },
                                        storage_used: { type: 'number' },
                                        storage_quota: { type: 'number', nullable: true },
                                        two_fa_enabled: { type: 'boolean' },
                                        is_active: { type: 'boolean' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        updated_at: { type: 'string', format: 'date-time' },
                                        storage_percentage: { type: 'number', example: 45 }
                                    }
                                }
                            }
                        },
                        example: {
                            user: {
                                id: 'abc-123-def',
                                username: 'john',
                                email: 'john@example.com',
                                role: 'user',
                                storage_used: 9663676416,
                                storage_quota: 21474836480,
                                two_fa_enabled: false,
                                is_active: true,
                                created_at: '2026-03-01T00:00:00Z',
                                updated_at: '2026-03-07T00:00:00Z',
                                storage_percentage: 45
                            }
                        }
                    }
                }
            },
            401: { description: 'Not authenticated' },
            404: { description: 'User not found' }
        }
    }
},
};