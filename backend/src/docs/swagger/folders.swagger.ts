export const folderPaths = {


    '/folders': {
        post: {
            tags: ['Folders'],
            summary: 'Create folder',
            description: `
**Create new folder for organizing files.**

**How it works:**
1. Validates folder name (no special characters)
2. Builds folder path based on parent
3. Checks for duplicate name in same location
4. Creates folder record in database
5. Logs CREATE_FOLDER activity

**Folder paths:**
- Root folder: /Documents
- Subfolder: /Documents/Photos
- Nested: /Documents/Photos/Vacation

**Path generation:**
- Root level (parent_folder_id=null): /{name}
- Subfolder: {parent_path}/{name}
- Example: Parent="/Documents", name="Photos" → "/Documents/Photos"

**Duplicate prevention:**
- Cannot create folder with same name in same location
- Different locations OK: /Documents/Photos and /Videos/Photos
- Case-sensitive: "documents" ≠ "Documents"

**Validation:**
- Name required (1-255 characters)
- No special characters: / \\ : * ? " < > |
- Parent folder must exist (if specified)
- Parent must belong to user

**Activity logging:**
- Logs CREATE_FOLDER action
- Records folder_name and path
- Tracks IP and user agent

**Use cases:**
- Organize files by category
- Create hierarchical structure
- Separate work/personal files
- Project organization

**Frontend implementation:**
\`\`\`javascript
// Create root folder
await fetch('/api/v1/folders', {
    method: 'POST',
    body: JSON.stringify({
        name: 'Documents',
        parent_folder_id: null
    })
});

// Create subfolder
await fetch('/api/v1/folders', {
    method: 'POST',
    body: JSON.stringify({
        name: 'Photos',
        parent_folder_id: 'parent-uuid-123'
    })
});
\`\`\`
        `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['name'],
                            properties: {
                                name: {
                                    type: 'string',
                                    minLength: 1,
                                    maxLength: 255,
                                    pattern: '^[^/\\\\:*?"<>|]+$',
                                    example: 'Documents',
                                    description: 'Folder name. Cannot contain: / \\ : * ? " < > |'
                                },
                                parent_folder_id: {
                                    type: 'string',
                                    format: 'uuid',
                                    nullable: true,
                                    example: null,
                                    description: 'Parent folder ID (null or omit = root level)'
                                }
                            }
                        },
                        examples: {
                            'Root folder': {
                                value: {
                                    name: 'Documents',
                                    parent_folder_id: null
                                }
                            },
                            'Subfolder': {
                                value: {
                                    name: 'Photos',
                                    parent_folder_id: 'da24e03c-4a84-406b-aa47-d1023403a7da'
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                201: {
                    description: 'Folder created successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message', 'folder'],
                                properties: {
                                    message: {
                                        type: 'string',
                                        example: 'Folder created successfully'
                                    },
                                    folder: {
                                        type: 'object',
                                        required: ['id', 'name', 'path', 'parent_folder_id', 'created_at'],
                                        properties: {
                                            id: {
                                                type: 'string',
                                                format: 'uuid',
                                                example: '23ed716c-e862-4f91-9972-690634a58f39',
                                                description: 'Folder ID'
                                            },
                                            name: {
                                                type: 'string',
                                                example: 'Documents',
                                                description: 'Folder name'
                                            },
                                            path: {
                                                type: 'string',
                                                example: '/Documents',
                                                description: 'Full folder path'
                                            },
                                            parent_folder_id: {
                                                type: 'string',
                                                format: 'uuid',
                                                nullable: true,
                                                example: null,
                                                description: 'Parent folder ID (null = root)'
                                            },
                                            created_at: {
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2026-02-21T21:27:15.057Z'
                                            }
                                        }
                                    }
                                }
                            },
                            examples: {
                                'Root folder created': {
                                    value: {
                                        message: 'Folder created successfully',
                                        folder: {
                                            id: '23ed716c-e862-4f91-9972-690634a58f39',
                                            name: 'Documents',
                                            path: '/Documents',
                                            parent_folder_id: null,
                                            created_at: '2026-02-21T21:27:15.057Z'
                                        }
                                    }
                                },
                                'Subfolder created': {
                                    value: {
                                        message: 'Folder created successfully',
                                        folder: {
                                            id: 'abc-123-def-456',
                                            name: 'Photos',
                                            path: '/Documents/Photos',
                                            parent_folder_id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                            created_at: '2026-02-21T21:27:15.057Z'
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                400: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            examples: {
                                'Invalid characters': {
                                    value: {
                                        error: 'Validation failed',
                                        message: 'Invalid input data',
                                        details: [
                                            {
                                                field: 'name',
                                                message: 'Folder name contains invalid characters (/, \\, :, *, ?, ", <, >, |)'
                                            }
                                        ]
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
                    description: 'Unauthorized - parent folder belongs to another user',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Unauthorized',
                                message: 'Unauthorized'
                            }
                        }
                    }
                },
                404: {
                    description: 'Parent folder not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Parent folder not found',
                                message: 'Parent folder not found'
                            }
                        }
                    }
                },
                409: {
                    description: 'Folder with this name already exists in this location',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder with this name already exists in this location',
                                message: 'Folder with this name already exists in this location'
                            }
                        }
                    }
                }
            }
        }, get: {
            tags: ['Folders'],
            summary: 'List user\'s folders',
            description: `
**Get user's folders with optional parent filtering.**

**How it works:**
1. Queries folders table for current user
2. Filters: is_deleted=false
3. Optionally filters by parent_folder_id
4. Orders by name ASC (alphabetical)
5. Returns array of folders

**Filtering by parent:**
- No parent_folder_id: Returns root folders only
- With parent_folder_id: Returns subfolders of that folder
- Hierarchical navigation: Get root → Get subfolders → Get sub-subfolders

**Response includes:**
- Folder ID
- Folder name
- Full path (e.g., /Documents/Photos)
- Parent folder ID (null = root)
- Created timestamp

**Use cases:**
- Display folder tree
- Navigate folder hierarchy
- Show root folders
- Show subfolders when user clicks folder

**Frontend implementation:**
\`\`\`javascript
// Get root folders
const rootFolders = await fetch('/api/v1/folders');

// Get subfolders of a folder
const subfolders = await fetch('/api/v1/folders?parent_folder_id=folder-uuid');

// Build folder tree
function buildTree(parentId = null) {
    const folders = await fetch(\`/api/v1/folders?parent_folder_id=\${parentId}\`);
    return folders.map(folder => ({
        ...folder,
        children: buildTree(folder.id)
    }));
}
\`\`\`

**Sorting:**
- Alphabetical by name (A-Z)
- Case-sensitive
- Folders sorted before displaying
        `,
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'parent_folder_id',
                    in: 'query',
                    required: false,
                    schema: {
                        type: 'string',
                        format: 'uuid'
                    },
                    example: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                    description: 'Parent folder ID. Omit or null for root folders.'
                }
            ],
            responses: {
                200: {
                    description: 'Folders retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['folders'],
                                properties: {
                                    folders: {
                                        type: 'array',
                                        description: 'Array of folder objects',
                                        items: {
                                            type: 'object',
                                            required: ['id', 'name', 'path', 'parent_folder_id', 'created_at'],
                                            properties: {
                                                id: {
                                                    type: 'string',
                                                    format: 'uuid',
                                                    example: '23ed716c-e862-4f91-9972-690634a58f39'
                                                },
                                                name: {
                                                    type: 'string',
                                                    example: 'renamedchildDocs'
                                                },
                                                path: {
                                                    type: 'string',
                                                    example: '/Documents/renamedchildDocs',
                                                    description: 'Full folder path from root'
                                                },
                                                parent_folder_id: {
                                                    type: 'string',
                                                    format: 'uuid',
                                                    nullable: true,
                                                    example: 'da24e03c-4a84-406b-aa47-d1023403a7da'
                                                },
                                                created_at: {
                                                    type: 'string',
                                                    format: 'date-time',
                                                    example: '2026-02-21T21:27:15.057Z'
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            examples: {
                                'Root folders': {
                                    summary: 'Get root-level folders',
                                    value: {
                                        folders: [
                                            {
                                                id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                                name: 'Documents',
                                                path: '/Documents',
                                                parent_folder_id: null,
                                                created_at: '2026-02-21T20:00:00.000Z'
                                            },
                                            {
                                                id: 'xyz-789-abc-123',
                                                name: 'Videos',
                                                path: '/Videos',
                                                parent_folder_id: null,
                                                created_at: '2026-02-21T21:00:00.000Z'
                                            }
                                        ]
                                    }
                                },
                                'Subfolders': {
                                    summary: 'Get subfolders of Documents',
                                    value: {
                                        folders: [
                                            {
                                                id: '23ed716c-e862-4f91-9972-690634a58f39',
                                                name: 'renamedchildDocs',
                                                path: '/Documents/renamedchildDocs',
                                                parent_folder_id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                                created_at: '2026-02-21T21:27:15.057Z'
                                            }
                                        ]
                                    }
                                },
                                'Empty (no folders)': {
                                    value: {
                                        folders: []
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
                }
            }
        }
    },

    '/folders/trash': {
        get: {
            tags: ['Folders'],
            summary: 'Get trashed folders',
            description: `
**Get user's deleted folders with days remaining until permanent deletion.**

**How it works:**
1. Queries folders table for current user
2. Filters: is_deleted=true
3. Orders by deleted_at DESC (most recently deleted first)
4. Calculates days until permanent deletion
5. Returns array of deleted folders

**30-day retention:**
- Folders stay in trash for 30 days
- After 30 days: Background job permanently deletes
- Can be restored anytime within 30 days
- Subfolders and files also in trash

**Days calculation:**
- Formula: 30 - days_since_deletion
- Example: Deleted 5 days ago = 25 days remaining
- When 0: Will be permanently deleted soon

**Cascade deletion:**
- When folder deleted: All subfolders also deleted
- All files in folder and subfolders also deleted
- All appear in trash
- Restore folder: Restores everything

**Response includes:**
- Folder ID (for restore)
- Folder name
- Full path
- Parent folder ID
- Deletion timestamp
- Days until permanent deletion

**Use cases:**
- View deleted folders
- Restore accidentally deleted folders
- Check what will be permanently deleted soon
- Trash management

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/folders/trash');
const data = await response.json();

data.folders.forEach(folder => {
    console.log(\`\${folder.name} - \${folder.days_until_permanent_delete} days left\`);
    
    if (folder.days_until_permanent_delete < 7) {
        showWarning(\`\${folder.name} will be permanently deleted soon!\`);
    }
});
\`\`\`

**Permanent deletion:**
- Automatic: Background job at 2 AM daily
- Deletes folders with deleted_at > 30 days
- Also deletes all subfolders and files
- Physical files deleted (if reference_count=0)
        `,
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Trashed folders retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['folders'],
                                properties: {
                                    folders: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            required: ['id', 'name', 'path', 'parent_folder_id', 'deleted_at', 'days_until_permanent_delete'],
                                            properties: {
                                                id: {
                                                    type: 'string',
                                                    format: 'uuid',
                                                    example: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                                    description: 'Folder ID (use for restore)'
                                                },
                                                name: {
                                                    type: 'string',
                                                    example: 'Documents'
                                                },
                                                path: {
                                                    type: 'string',
                                                    example: '/Documents',
                                                    description: 'Full folder path'
                                                },
                                                parent_folder_id: {
                                                    type: 'string',
                                                    format: 'uuid',
                                                    nullable: true,
                                                    example: null
                                                },
                                                deleted_at: {
                                                    type: 'string',
                                                    format: 'date-time',
                                                    example: '2026-02-20T10:00:00.000Z',
                                                    description: 'When folder was deleted'
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
                                    }
                                }
                            },
                            examples: {
                                'Trash with folders': {
                                    value: {
                                        folders: [
                                            {
                                                id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                                name: 'Documents',
                                                path: '/Documents',
                                                parent_folder_id: null,
                                                deleted_at: '2026-02-20T10:00:00.000Z',
                                                days_until_permanent_delete: 25
                                            }
                                        ]
                                    }
                                },
                                'Empty trash': {
                                    value: {
                                        folders: []
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
                }
            }
        }
    },

    '/folders/{id}': {
        get: {
            tags: ['Folders'],
            summary: 'Get folder by ID',
            description: `
**Get folder details by ID.**

**How it works:**
1. Verifies folder exists
2. Checks user owns the folder
3. Checks folder is not deleted
4. Returns folder details

**Response includes:**
- Folder ID
- Folder name
- Full path
- Parent folder ID
- Created timestamp
- Updated timestamp

**Authorization:**
- User must own the folder
- Cannot access other users' folders
- Returns 403 if not owner

**Use cases:**
- Get folder details
- Verify folder exists
- Check folder path
- Display folder info

**Deleted folders:**
- Returns 404 if folder is in trash
- Use GET /folders/trash to see deleted folders
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
                    example: '23ed716c-e862-4f91-9972-690634a58f39',
                    description: 'Folder ID'
                }
            ],
            responses: {
                200: {
                    description: 'Folder retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['folder'],
                                properties: {
                                    folder: {
                                        type: 'object',
                                        required: ['id', 'name', 'path', 'parent_folder_id', 'created_at', 'updated_at'],
                                        properties: {
                                            id: {
                                                type: 'string',
                                                format: 'uuid',
                                                example: '23ed716c-e862-4f91-9972-690634a58f39'
                                            },
                                            name: {
                                                type: 'string',
                                                example: 'Photos'
                                            },
                                            path: {
                                                type: 'string',
                                                example: '/Documents/Photos'
                                            },
                                            parent_folder_id: {
                                                type: 'string',
                                                format: 'uuid',
                                                nullable: true,
                                                example: 'da24e03c-4a84-406b-aa47-d1023403a7da'
                                            },
                                            created_at: {
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2026-02-21T21:27:15.057Z'
                                            },
                                            updated_at: {
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2026-02-21T21:30:00.000Z'
                                            }
                                        }
                                    }
                                }
                            },
                            example: {
                                folder: {
                                    id: '23ed716c-e862-4f91-9972-690634a58f39',
                                    name: 'Photos',
                                    path: '/Documents/Photos',
                                    parent_folder_id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                    created_at: '2026-02-21T21:27:15.057Z',
                                    updated_at: '2026-02-21T21:30:00.000Z'
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
                    description: 'Unauthorized - folder belongs to another user',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Unauthorized',
                                message: 'Unauthorized'
                            }
                        }
                    }
                },
                404: {
                    description: 'Folder not found or in trash',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            examples: {
                                'Not found': {
                                    value: {
                                        error: 'Folder not found',
                                        message: 'Folder not found'
                                    }
                                },
                                'In trash': {
                                    value: {
                                        error: 'Folder is in trash',
                                        message: 'Folder is in trash'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        put: {
            tags: ['Folders'],
            summary: 'Rename folder',
            description: `
**Rename folder and automatically update all subfolder paths.**

**How it works:**
1. Verifies folder exists and user owns it
2. Builds new path based on new name
3. Updates folder name and path
4. Finds all subfolders (path LIKE 'old_path/%')
5. Updates all subfolder paths (replaces old path with new)
6. Logs RENAME_FOLDER activity

**Path updates (automatic):**
- Folder: /Documents → /Files
- Subfolder: /Documents/Photos → /Files/Photos
- Nested: /Documents/Photos/Vacation → /Files/Photos/Vacation
- All paths updated in single operation

**Example:**
- Rename "Documents" to "Files"
- Old paths: /Documents, /Documents/Photos, /Documents/Photos/Vacation
- New paths: /Files, /Files/Photos, /Files/Photos/Vacation
- All subfolders automatically updated

**Validation:**
- Name required (1-255 characters)
- No special characters: / \\ : * ? " < > |
- Same validation as create folder

**Activity logging:**
- Logs RENAME_FOLDER action
- Records new_name and path
- Tracks IP and user agent

**Authorization:**
- User must own the folder
- Cannot rename other users' folders
- Returns 403 if not owner

**Use cases:**
- Fix typos in folder names
- Reorganize folder structure
- Better naming conventions
- Project renaming
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
                    example: '23ed716c-e862-4f91-9972-690634a58f39',
                    description: 'Folder ID to rename'
                }
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['name'],
                            properties: {
                                name: {
                                    type: 'string',
                                    minLength: 1,
                                    maxLength: 255,
                                    pattern: '^[^/\\\\:*?"<>|]+$',
                                    example: 'New Folder Name',
                                    description: 'New folder name. Cannot contain: / \\ : * ? " < > |'
                                }
                            }
                        },
                        example: {
                            name: 'renamedchildDocs'
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Folder renamed successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message', 'folder'],
                                properties: {
                                    message: {
                                        type: 'string',
                                        example: 'Folder renamed successfully'
                                    },
                                    folder: {
                                        type: 'object',
                                        required: ['id', 'name', 'path'],
                                        properties: {
                                            id: {
                                                type: 'string',
                                                format: 'uuid',
                                                example: '23ed716c-e862-4f91-9972-690634a58f39'
                                            },
                                            name: {
                                                type: 'string',
                                                example: 'renamedchildDocs',
                                                description: 'New folder name'
                                            },
                                            path: {
                                                type: 'string',
                                                example: '/Documents/renamedchildDocs',
                                                description: 'Updated full path'
                                            }
                                        }
                                    }
                                }
                            },
                            example: {
                                message: 'Folder renamed successfully',
                                folder: {
                                    id: '23ed716c-e862-4f91-9972-690634a58f39',
                                    name: 'renamedchildDocs',
                                    path: '/Documents/renamedchildDocs'
                                }
                            }
                        }
                    }
                },
                400: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Validation failed',
                                message: 'Invalid input data',
                                details: [
                                    {
                                        field: 'name',
                                        message: 'Folder name contains invalid characters'
                                    }
                                ]
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
                    description: 'Unauthorized - folder belongs to another user',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Unauthorized',
                                message: 'Unauthorized'
                            }
                        }
                    }
                },
                404: {
                    description: 'Folder not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder not found',
                                message: 'Folder not found'
                            }
                        }
                    }
                }
            }
        },
        delete: {
            tags: ['Folders'],
            summary: 'Delete folder (soft delete - move to trash)',
            description: `
**Move folder to trash (soft delete) - can be restored within 30 days.**

**How it works:**
1. Verifies folder exists and user owns it
2. Sets is_deleted=true, deleted_at=now on folder
3. Finds all subfolders (path LIKE 'folder_path/%')
4. Sets is_deleted=true on all subfolders
5. Finds all files in folder and subfolders
6. Sets is_deleted=true on all files
7. Logs DELETE_FOLDER activity

**Cascade deletion:**
- Folder deleted → All subfolders deleted
- All files in folder deleted
- All files in subfolders deleted
- Everything moves to trash together

**Example:**
- Delete /Documents
- Also deleted: /Documents/Photos, /Documents/Photos/Vacation
- Also deleted: All files in Documents and its subfolders
- All can be restored together

**30-day retention:**
- Folder stays in trash for 30 days
- Can be restored: POST /folders/:id/restore
- After 30 days: Background job permanently deletes
- View trash: GET /folders/trash

**Storage quota:**
- NOT freed on soft delete (folders don't use storage)
- File storage freed when files deleted
- Quota restored if folder restored

**Activity logging:**
- Logs DELETE_FOLDER action
- Records folder_id
- Tracks IP and user agent

**Authorization:**
- User must own the folder
- Cannot delete other users' folders
- Returns 403 if not owner

**Warning:**
- Deletes all contents (subfolders + files)
- Can be restored within 30 days
- For permanent delete: Wait 30 days or use background job
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
                    example: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                    description: 'Folder ID to delete'
                }
            ],
            responses: {
                200: {
                    description: 'Folder moved to trash successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    message: {
                                        type: 'string',
                                        example: 'Folder moved to trash',
                                        description: 'Success message'
                                    }
                                }
                            },
                            example: {
                                message: 'Folder moved to trash'
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
                    description: 'Unauthorized - folder belongs to another user',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Unauthorized',
                                message: 'Unauthorized'
                            }
                        }
                    }
                },
                404: {
                    description: 'Folder not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder not found',
                                message: 'Folder not found'
                            }
                        }
                    }
                }
            }
        }
    },

    '/folders/{id}/restore': {
        post: {
            tags: ['Folders'],
            summary: 'Restore folder from trash',
            description: `
**Restore deleted folder from trash - includes all subfolders and files.**

**How it works:**
1. Verifies folder exists and user owns it
2. Checks folder is in trash (is_deleted=true)
3. Sets is_deleted=false, deleted_at=null on folder
4. Finds all subfolders (path LIKE 'folder_path/%')
5. Sets is_deleted=false on all subfolders
6. Finds all files in folder and subfolders
7. Sets is_deleted=false on all files
8. Logs RESTORE_FOLDER activity

**Cascade restoration:**
- Folder restored → All subfolders restored
- All files in folder restored
- All files in subfolders restored
- Everything restored together

**Example:**
- Restore /Documents
- Also restored: /Documents/Photos, /Documents/Photos/Vacation
- Also restored: All files in Documents and its subfolders
- Entire folder structure restored

**Requirements:**
- Folder must be in trash (is_deleted=true)
- User must own the folder
- Folder must not be permanently deleted yet

**Activity logging:**
- Logs RESTORE_FOLDER action
- Records folder_id
- Tracks IP and user agent

**Authorization:**
- User must own the folder
- Cannot restore other users' folders
- Returns 403 if not owner

**Storage quota:**
- Files restored → Storage quota re-applied
- Validates user has space for all files
- May fail if quota exceeded

**Error cases:**
- Folder not in trash: Returns 400
- Folder not found: Returns 404
- Not owner: Returns 403
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
                    example: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                    description: 'Folder ID to restore (get from /folders/trash)'
                }
            ],
            responses: {
                200: {
                    description: 'Folder restored from trash successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    message: {
                                        type: 'string',
                                        example: 'Folder restored from trash',
                                        description: 'Success message'
                                    }
                                }
                            },
                            example: {
                                message: 'Folder restored from trash'
                            }
                        }
                    }
                },
                400: {
                    description: 'Folder is not in trash',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder is not in trash',
                                message: 'Folder is not in trash'
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
                    description: 'Unauthorized - folder belongs to another user',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Unauthorized',
                                message: 'Unauthorized'
                            }
                        }
                    }
                },
                404: {
                    description: 'Folder not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder not found',
                                message: 'Folder not found'
                            }
                        }
                    }
                }
            }
        }
    },

    '/folders/tree': {
        get: {
            tags: ['Folders'],
            summary: 'Get complete folder tree with files',
            description: `
**Get complete hierarchical folder structure with all files in a single API call.**

**How it works:**
1. Fetches all non-deleted folders for user
2. Fetches all non-deleted, available files for user
3. Builds hierarchical tree structure recursively
4. Includes files in each folder
5. Returns complete tree starting from root folders

**Tree structure:**
- Root folders at top level
- Each folder contains subfolders array
- Each folder contains files array
- Recursive nesting (unlimited depth)
- Sorted alphabetically (folders and files)

**Response includes for each folder:**
- Folder ID, name, path
- Parent folder ID
- Created timestamp
- Subfolders array (recursive)
- Files array (in this folder)
- file_count (number of files in this folder)
- subfolder_count (number of direct subfolders)

**Response includes for each file:**
- File ID, name, size, MIME type
- Created timestamp

**Use cases:**
- Display complete file browser
- Render folder tree in sidebar
- Show entire structure at once
- Navigate folders visually
- Drag-and-drop file organization

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/folders/tree');
const { tree } = await response.json();

// Render tree recursively
function renderFolder(folder) {
    return (
        <div>
            <h3>{folder.name} ({folder.file_count} files)</h3>
            
            {/* Render files */}
            {folder.files.map(file => (
                <div key={file.id}>{file.original_name}</div>
            ))}
            
            {/* Render subfolders recursively */}
            {folder.subfolders.map(subfolder => (
                <div key={subfolder.id}>
                    {renderFolder(subfolder)}
                </div>
            ))}
        </div>
    );
}

tree.forEach(rootFolder => renderFolder(rootFolder));
\`\`\`

**Performance:**
- Single database query for folders
- Single database query for files
- Tree built in memory (fast)
- Efficient for up to 10,000 folders/files
- For larger datasets: Use paginated /folders endpoint

**Example response:**
\`\`\`json
{
  "tree": [
    {
      "id": "folder-1",
      "name": "Documents",
      "path": "/Documents",
      "parent_folder_id": null,
      "created_at": "2026-02-21T20:00:00Z",
      "file_count": 2,
      "subfolder_count": 1,
      "files": [
        {
          "id": "file-1",
          "original_name": "report.pdf",
          "size": 2048576,
          "mime_type": "application/pdf",
          "created_at": "2026-02-21T21:00:00Z"
        }
      ],
      "subfolders": [
        {
          "id": "folder-2",
          "name": "Photos",
          "path": "/Documents/Photos",
          "parent_folder_id": "folder-1",
          "created_at": "2026-02-21T21:30:00Z",
          "file_count": 3,
          "subfolder_count": 0,
          "files": [
            {
              "id": "file-2",
              "original_name": "photo.jpg",
              "size": 1024000,
              "mime_type": "image/jpeg",
              "created_at": "2026-02-22T10:00:00Z"
            }
          ],
          "subfolders": []
        }
      ]
    }
  ]
}
\`\`\`
        `,
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Folder tree retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['tree'],
                                properties: {
                                    tree: {
                                        type: 'array',
                                        description: 'Array of root folders with nested structure',
                                        items: {
                                            type: 'object',
                                            required: ['id', 'name', 'path', 'parent_folder_id', 'created_at', 'subfolders', 'files', 'file_count', 'subfolder_count'],
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                name: { type: 'string', example: 'Documents' },
                                                path: { type: 'string', example: '/Documents' },
                                                parent_folder_id: { type: 'string', format: 'uuid', nullable: true, example: null },
                                                created_at: { type: 'string', format: 'date-time' },
                                                file_count: { type: 'number', example: 2, description: 'Number of files in this folder' },
                                                subfolder_count: { type: 'number', example: 1, description: 'Number of direct subfolders' },
                                                files: {
                                                    type: 'array',
                                                    description: 'Files in this folder',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            id: { type: 'string', format: 'uuid' },
                                                            original_name: { type: 'string' },
                                                            size: { type: 'number' },
                                                            mime_type: { type: 'string' },
                                                            created_at: { type: 'string', format: 'date-time' }
                                                        }
                                                    }
                                                },
                                                subfolders: {
                                                    type: 'array',
                                                    description: 'Nested subfolders (recursive structure)',
                                                    items: {
                                                        type: 'object',
                                                        description: 'Same structure as parent folder (recursive)'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            example: {
                                tree: [
                                    {
                                        id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                        name: 'TestFolder',
                                        path: '/TestFolder',
                                        parent_folder_id: null,
                                        created_at: '2026-02-21T20:00:00.000Z',
                                        file_count: 2,
                                        subfolder_count: 1,
                                        files: [
                                            {
                                                id: '70b65f23-c905-4554-9e6e-b5616b2519b4',
                                                original_name: 'test-file.txt',
                                                size: 36,
                                                mime_type: 'text/plain',
                                                created_at: '2026-02-22T09:46:25.000Z'
                                            },
                                            {
                                                id: '222d1511-2bd9-4e1d-a4c6-978ced6f2f13',
                                                original_name: 'smolsize.mov',
                                                size: 30,
                                                mime_type: 'video/quicktime',
                                                created_at: '2026-02-22T09:46:25.000Z'
                                            }
                                        ],
                                        subfolders: [
                                            {
                                                id: '23ed716c-e862-4f91-9972-690634a58f39',
                                                name: 'SubFolder',
                                                path: '/TestFolder/SubFolder',
                                                parent_folder_id: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                                                created_at: '2026-02-21T21:27:15.000Z',
                                                file_count: 2,
                                                subfolder_count: 0,
                                                files: [
                                                    {
                                                        id: '6eec7202-34a3-4ae3-9cce-df35e2e62e57',
                                                        original_name: 'subfolder-file1.txt',
                                                        size: 28,
                                                        mime_type: 'text/plain',
                                                        created_at: '2026-02-22T09:46:25.000Z'
                                                    },
                                                    {
                                                        id: 'd05a519b-b793-4b4a-9742-fb847041acff',
                                                        original_name: 'subfolder-file2.txt',
                                                        size: 28,
                                                        mime_type: 'text/plain',
                                                        created_at: '2026-02-22T09:46:25.000Z'
                                                    }
                                                ],
                                                subfolders: []
                                            }
                                        ]
                                    }
                                ]
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
                }
            }
        }
    },
    '/folders/{id}/permanent': {
        delete: {
            tags: ['Folders'],
            summary: 'Permanently delete folder',
            description: `
**Permanently delete a folder and ALL its contents from the system. This action is irreversible.**

**⚠️ WARNING: This cannot be undone. All files and subfolders will be permanently lost.**

**Prerequisites:**
- Folder must already be in trash (soft-deleted)
- Use \`DELETE /folders/{id}\` first to move folder to trash
- Then use this endpoint to permanently destroy it

**How it works:**
1. Verifies folder exists and belongs to authenticated user
2. Checks folder is in trash (\`is_deleted=true\`) — returns 400 if not
3. Collects all subfolder IDs (using path LIKE matching)
4. Finds all File records across the folder and every subfolder
5. For each file:
   - Looks up FileReference (deduplication record)
   - If \`reference_count = 1\`: deletes physical file from disk + destroys FileReference
   - If \`reference_count > 1\`: decrements reference count only (other users still have the file)
   - Subtracts file size from user's storage quota
   - Hard deletes the File DB record (SharedLinks auto-cascade deleted)
6. Hard deletes all Folder DB records (this folder + all subfolders)
7. Logs DELETE_FOLDER activity with \`permanent: true\`

**Cascade deletion:**
- All subfolders permanently deleted
- All files in all subfolders permanently deleted
- All shared links for deleted files automatically removed (DB cascade)
- User storage quota freed

**Deduplication handling:**
- Files are deduplicated — multiple users may share the same physical file
- Physical file on disk is only deleted when the last reference is removed
- Each user's File record is deleted independently
- Other users' copies of deduplicated files are unaffected

**Storage quota:**
- Each deleted file's size is subtracted from the user's storage usage
- Quota freed immediately upon permanent deletion

**Use cases:**
- Free up storage space immediately without waiting 30 days
- Clean up sensitive data permanently
- Bulk remove large folder structures

**Comparison with soft delete:**
| Action | DB record | Physical file | Restorable | Storage freed |
|---|---|---|---|---|
| Soft delete (\`DELETE /folders/{id}\`) | Marked deleted | Kept | Yes (30 days) | No |
| Permanent delete (\`DELETE /folders/{id}/permanent\`) | Destroyed | Deleted if last ref | No | Yes |

**Frontend implementation:**
\`\`\`javascript
// Step 1: Move to trash (soft delete)
await fetch('/api/v1/folders/folder-uuid', { method: 'DELETE' });

// Step 2: Permanently destroy (from trash view)
const confirmed = confirm('Delete forever? This cannot be undone!');
if (confirmed) {
    await fetch('/api/v1/folders/folder-uuid/permanent', { method: 'DELETE' });
}
\`\`\`
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
                    example: 'da24e03c-4a84-406b-aa47-d1023403a7da',
                    description: 'Folder ID (must be in trash)'
                }
            ],
            responses: {
                200: {
                    description: 'Folder permanently deleted',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    message: {
                                        type: 'string',
                                        example: 'Folder permanently deleted'
                                    }
                                }
                            },
                            example: {
                                message: 'Folder permanently deleted'
                            }
                        }
                    }
                },
                400: {
                    description: 'Folder is not in trash',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder must be in trash before permanently deleting',
                                message: 'Folder must be in trash before permanently deleting'
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
                    description: 'Unauthorized — folder belongs to another user',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Unauthorized',
                                message: 'Unauthorized'
                            }
                        }
                    }
                },
                404: {
                    description: 'Folder not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: {
                                error: 'Folder not found',
                                message: 'Folder not found'
                            }
                        }
                    }
                }
            }
        }
    },

    '/folders/{id}/public': {
    put: {
        tags: ['Folders'],
        summary: 'Make folder public (Admin/Owner)',
        description: `
**Make a folder publicly accessible with custom slug.**

**How it works:**
1. Admin/owner sets custom slug (e.g., "memes")
2. Folder becomes accessible at /public/folders/memes
3. Anyone can view and download files

**Slug validation:**
- Lowercase letters, numbers, hyphens only
- Must be unique
- Examples: "memes", "icons", "cool-stuff"

**Use cases:**
- Share meme collection publicly
- Host icons/assets for websites
- Public wallpaper gallery
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
                        required: ['slug'],
                        properties: {
                            slug: {
                                type: 'string',
                                example: 'memes',
                                description: 'Custom URL slug'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Folder is now public',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                folder: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        is_public: { type: 'boolean' },
                                        public_slug: { type: 'string' },
                                        public_url: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: { description: 'Invalid slug format' },
            401: { description: 'Not authenticated' },
            403: { description: 'Unauthorized' },
            404: { description: 'Folder not found' },
            409: { description: 'Slug already taken' }
        }
    },
    
    delete: {
        tags: ['Folders'],
        summary: 'Make folder private (Admin/Owner)',
        description: `
**Remove public access from a folder.**

**Removes public slug and makes folder private again.**
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
            200: { description: 'Folder is now private' },
            401: { description: 'Not authenticated' },
            403: { description: 'Unauthorized' },
            404: { description: 'Folder not found' }
        }
    }
},

};
