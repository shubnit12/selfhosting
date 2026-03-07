export const publicFolderPaths = {
    '/public/folders': {
        get: {
            tags: ['Public Folders'],
            summary: 'List all public folders (No auth required)',
            description: `
**Get list of all publicly accessible folders.**

**No authentication required** - anyone can access.

**Returns:**
- Folder ID, name, slug
- Public URL path
- Created timestamp

**Use cases:**
- Display public folder gallery
- Browse available public content
- Show memes, icons, wallpapers folders

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/public/folders');
const { folders } = await response.json();

folders.forEach(folder => {
    console.log(\`\${folder.name}: /public/folders/\${folder.public_slug}\`);
});
\`\`\`
            `,
            responses: {
                200: {
                    description: 'Public folders retrieved',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    folders: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                name: { type: 'string', example: 'Memes' },
                                                public_slug: { type: 'string', example: 'memes' },
                                                path: { type: 'string', example: '/Memes' },
                                                created_at: { type: 'string', format: 'date-time' }
                                            }
                                        }
                                    }
                                }
                            },
                            example: {
                                folders: [
                                    {
                                        id: 'abc-123',
                                        name: 'Memes',
                                        public_slug: 'memes',
                                        path: '/Memes',
                                        created_at: '2026-03-01T00:00:00Z'
                                    },
                                    {
                                        id: 'def-456',
                                        name: 'Icons',
                                        public_slug: 'icons',
                                        path: '/Icons',
                                        created_at: '2026-03-02T00:00:00Z'
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        }
    },

    '/public/folders/{slug}': {
        get: {
            tags: ['Public Folders'],
            summary: 'Get public folder contents (No auth required)',
            description: `
**Get files in a public folder by slug.**

**No authentication required** - anyone can access.

**Returns:**
- Folder info (id, name, slug, path)
- List of files with thumbnails
- File metadata (name, size, type)

**Use cases:**
- Display public folder contents
- Show memes/icons/wallpapers gallery
- Browse public files

**Frontend implementation:**
\`\`\`javascript
const response = await fetch('/api/v1/public/folders/memes');
const { folder, files } = await response.json();

files.forEach(file => {
    console.log(\`\${file.original_name} - \${file.size} bytes\`);
    // Display thumbnail if available
    if (file.thumbnail_path) {
        // Show thumbnail
    }
});
\`\`\`
            `,
            parameters: [
                {
                    name: 'slug',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    example: 'memes',
                    description: 'Public folder slug'
                }
            ],
            responses: {
                200: {
                    description: 'Public folder contents',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    folder: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', format: 'uuid' },
                                            name: { type: 'string' },
                                            slug: { type: 'string' },
                                            path: { type: 'string' }
                                        }
                                    },
                                    files: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                original_name: { type: 'string' },
                                                size: { type: 'number' },
                                                mime_type: { type: 'string' },
                                                thumbnail_path: { type: 'string', nullable: true },
                                                created_at: { type: 'string', format: 'date-time' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                404: { description: 'Public folder not found' }
            }
        }
    },

    '/public/folders/{slug}/files/{fileId}/download': {
        get: {
            tags: ['Public Folders'],
            summary: 'Download file from public folder (No auth required)',
            description: `
**Download a file from a public folder.**

**No authentication required** - anyone can download.

**How it works:**
1. Verifies folder is public
2. Verifies file is in that folder
3. Streams file for download

**Use cases:**
- Download memes/icons/wallpapers
- Public file distribution
- CDN-like file serving
            `,
            parameters: [
                {
                    name: 'slug',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    example: 'memes'
                },
                {
                    name: 'fileId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', format: 'uuid' }
                }
            ],
            responses: {
                200: {
                    description: 'File download',
                    content: {
                        'application/octet-stream': {
                            schema: {
                                type: 'string',
                                format: 'binary'
                            }
                        }
                    }
                },
                403: { description: 'File not in this folder' },
                404: { description: 'Folder or file not found' }
            }
        }
    },
    '/public/folders/{slug}/files/{fileId}/thumbnail': {
    get: {
        tags: ['Public Folders'],
        summary: 'Get thumbnail from public folder (No auth required)',
        description: `
**Get thumbnail image for a file in a public folder.**

**No authentication required** - anyone can access.

**How it works:**
1. Verifies folder is public
2. Verifies file is in that folder
3. Streams thumbnail as JPEG image
4. Caches for 1 year

**Use cases:**
- Display thumbnails in public gallery
- Show image previews for memes/icons
- Grid view of public files

**Frontend implementation:**
\`\`\`javascript
<img 
  src={\`/api/v1/public/folders/memes/files/\${fileId}/thumbnail\`} 
  alt="thumbnail" 
/>
\`\`\`
        `,
        parameters: [
            {
                name: 'slug',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                example: 'memes'
            },
            {
                name: 'fileId',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' }
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
            403: { description: 'File not in this folder' },
            404: {
                description: 'Folder, file, or thumbnail not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        examples: {
                            'No thumbnail': {
                                value: { error: 'Thumbnail not available' }
                            }
                        }
                    }
                }
            }
        }
    }
    }
};