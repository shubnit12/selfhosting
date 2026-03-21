export const assetPaths = {
    '/assets/upload': {
        post: {
            tags: ['Assets'],
            summary: 'Upload an asset file (API key required)',
            description: `...`,
            security: [{ apiKeyAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: {
                            type: 'object',
                            properties: {
                                file: {
                                    type: 'string',
                                    format: 'binary',
                                    description: 'File to upload'
                                }
                            },
                            required: ['file']
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Asset uploaded successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    url: { type: 'string', example: 'http://localhost:3000/api/v1/assets/image.jpg' },
                                    filename: { type: 'string', example: 'image.jpg' },
                                    size: { type: 'number', example: 102400 },
                                    mimeType: { type: 'string', example: 'image/jpeg' }
                                }
                            }
                        }
                    }
                },
                400: { description: 'No file provided' },
                401: { description: 'Invalid or missing API key' },
                413: { description: 'File too large' },
                500: { description: 'Asset API key not configured on server' }
            }
        }
    },
        '/assets/{filename}': {
        get: {
            tags: ['Assets'],
            summary: 'Serve an asset file (No auth required)',
            description: `**Public endpoint** - no authentication needed. Streams the file directly.`,
            parameters: [
                {
                    name: 'filename',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    example: 'image.jpg',
                    description: 'Filename of the asset to serve'
                }
            ],
            responses: {
                200: {
                    description: 'File stream',
                    content: {
                        'application/octet-stream': {
                            schema: { type: 'string', format: 'binary' }
                        }
                    }
                },
                400: { description: 'Invalid filename' },
                404: { description: 'Asset not found' }
            }
        }
    }
};
