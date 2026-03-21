export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '107374182400'); // 100GB
export const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '104857600'); // 100MB

export const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
export const FILES_PATH = `${STORAGE_PATH}/files`;
export const THUMBNAILS_PATH = `${STORAGE_PATH}/thumbnails`;
export const TEMP_PATH = `${STORAGE_PATH}/temp`;

export const THUMBNAIL_SIZE = 150;
export const THUMBNAIL_QUALITY = 85;
export const VIDEO_THUMBNAIL_FRAMES = 4;

export const TRASH_RETENTION_DAYS = 30;
export const BACKUP_RETENTION_DAYS = 7;

export const DEFAULT_USER_QUOTA = 20 * 1024 * 1024 * 1024; // 20GB in bytes

export const ASSETS_PATH = `${STORAGE_PATH}/assets`;
export const ASSET_API_KEY = process.env.ASSET_API_KEY || '';
export const ASSET_MAX_FILE_SIZE = parseInt(process.env.ASSET_MAX_FILE_SIZE || '52428800'); // 50MB

export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  videos: ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
};
console.log("process.env.AUTH_RATE_LIMIT_MAX " , process.env.AUTH_RATE_LIMIT_MAX )
export const RATE_LIMITS = {
    // General API rate limit
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),  // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
    
    // Auth endpoints rate limit (stricter)
    AUTH_WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
    AUTH_MAX_REQUESTS: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
    
    // File upload rate limit
    UPLOAD_WINDOW_MS: 60 * 60 * 1000,  // 1 hour
    UPLOAD_MAX_REQUESTS: 9000,
    
    // File download rate limit
    DOWNLOAD_WINDOW_MS: 60 * 60 * 1000,  // 1 hour
    DOWNLOAD_MAX_REQUESTS: 500,
};

export const JWT_CONFIG = {
// JWT Secrets
    SECRET: (process.env.JWT_SECRET || 'fallback_secret_change_in_production') as string,
    REFRESH_SECRET: (process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_change_in_production') as string,
    
    // Token Expiry
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',  // 15 minutes
    REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',  // 7 days
    
    // Token Expiry in seconds (for Redis TTL)
    EXPIRES_IN_SECONDS: 15 * 60,  // 15 minutes
    REFRESH_EXPIRES_IN_SECONDS: 7 * 24 * 60 * 60,  // 7 days
};
export const BCRYPT_CONFIG = {
    SALT_ROUNDS: 12,  // As per your specification
};

export const CORS_CONFIG = {
    ORIGIN: process.env.FRONTEND_URL || 'http://localhost:5173',
    CREDENTIALS: true,
};

export const SERVER_CONFIG = {
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
