# selfhosting
# Android Phone File Server - Complete Project Specification

## Project Overview

A self-hosted file storage and sharing server running on an Android phone, accessible from anywhere on the internet. The system supports multiple users, large file uploads (up to 100GB), automatic thumbnail generation, shareable links, and comprehensive file management features.

---

## Core Requirements

### Storage & Access
- **Storage Capacity**: 200GB total on Android phone
- **Internet Access**: From anywhere via Port Forwarding + DDNS
- **Max File Size**: 100GB per file
- **Supported File Types**: All types (images, videos, documents, archives, etc.)
- **Virus Scanning**: Not required

### User Management
- **Multi-user**: Supported from day 1
- **User Creation**: Admin-only (you create users manually, no public registration)
- **User Roles**: Admin (you) with unlimited storage and special permissions, Regular users with 20GB quota
- **Authentication**: JWT-based with 2FA (Two-Factor Authentication using TOTP)

### File Operations
- Upload files (any size up to 100GB via chunked uploads)
- Download files
- Preview generation (images, videos, PDFs)
- File versioning (keep history when same filename uploaded)
- Soft delete with trash bin (30-day retention)
- Bulk operations (download, delete, move)
- Duplicate detection and deduplication
- Folder/album organization
- Search by filename, date, file type
- Sort by name, date, size, type
- Grid view and List view toggle
- Pagination (50 files per page)

### Shareable Links
- Generate public shareable links for any file
- **Expiration time**: Configurable (1 hour, 24 hours, 7 days, 30 days, never)
- **Download limit**: Configurable (1, 5, 10, unlimited)
- **Password protection**: Optional
- **Preview support**: Yes, show preview before download
- Public access (no login required for shared links)

### File Preview/Thumbnails
- **Images**: Always generate thumbnails automatically
- **Videos**: Generate animated thumbnail (from first few frames), no full preview needed
- **PDFs**: Generate thumbnail from first page only
- **Documents/Others**: Icon-based on mime type

### Additional Features
- Activity logs (track who accessed what and when)
- Download multiple files as ZIP
- File versioning/history
- Lazy loading for images in UI
- CDN-style caching headers
- Rate limiting per user
- Automatic startup on phone boot
- Process monitoring (PM2)
- Periodic database backups
- Search functionality
- Storage quota enforcement

### Features NOT Needed (Now)
- Virus/malware scanning
- Video/audio media player in UI
- Dark mode
- Failed login account locking
- Mobile app (React Native)
- Collaborative features (shared folders between users)
- Archive thumbnails (ZIP/RAR file listings)
- Full video preview generation (only thumbnails needed)

---

## Technology Stack

### Backend
```
Core:
- Node.js v18+ (LTS)
- Express.js (API framework)
- PostgreSQL (database)
- Redis (job queue storage)

Authentication & Security:
- JWT (JSON Web Tokens)
- speakeasy (2FA/TOTP implementation)
- bcrypt (password hashing, salt rounds: 12)
- helmet (security headers)
- cors (CORS handling)
- express-rate-limit (rate limiting)

File Handling:
- Multer (file upload handling)
- Sharp (image processing/thumbnails)
- FFmpeg (video thumbnail generation - animated)
- pdf-poppler or pdf2pic (PDF thumbnails)
- archiver (ZIP creation for bulk downloads)

Background Jobs:
- BullMQ (job queue - WITHOUT priority queue)
- Redis (required for BullMQ)

ORM/Database:
- Sequelize or Prisma (PostgreSQL ORM)
```

### Frontend
```
Core:
- React 18+
- React Router (navigation)
- Vite (build tool)

UI & Styling:
- Tailwind CSS
- shadcn/ui (component library)

State & Data:
- React Query (data fetching/caching)
- Zustand or Context API (state management)
- Axios (API calls)

File Upload:
- react-dropzone (drag & drop upload)

2FA:
- qrcode.react (for 2FA QR codes)
```

### Infrastructure
```
Reverse Proxy & Web Server:
- nginx (reverse proxy + SSL termination + static file serving)

SSL/HTTPS:
- Certbot (Let's Encrypt SSL certificates)
- Automatic renewal: Yes

Dynamic DNS:
- DuckDNS (free dynamic DNS service)

Process Management:
- PM2 (Node.js process manager with auto-restart)

Android Environment:
- Termux (Linux terminal emulator for Android)

Networking:
- Port Forwarding (Router configuration: port 443 → phone)
- DDNS updater (keeps domain pointing to current IP)
```

---

## Database Schema

### users table
```
- id (UUID, Primary Key)
- username (VARCHAR, UNIQUE, NOT NULL)
- email (VARCHAR, UNIQUE, NOT NULL)
- password_hash (VARCHAR, NOT NULL)
- role (ENUM: 'admin', 'user')
- storage_quota (BIGINT, bytes, NULL = unlimited for admin)
- storage_used (BIGINT, bytes, DEFAULT 0)
- two_fa_secret (VARCHAR, NULLABLE)
- two_fa_enabled (BOOLEAN, DEFAULT false)
- created_at (TIMESTAMP, DEFAULT NOW())
- updated_at (TIMESTAMP, DEFAULT NOW())

Indexes:
- PRIMARY KEY (id)
- UNIQUE INDEX (username)
- UNIQUE INDEX (email)
```

### folders table
```
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → users.id)
- parent_folder_id (UUID, Foreign Key → folders.id, NULLABLE for root)
- name (VARCHAR, NOT NULL)
- path (TEXT, full path for quick lookups)
- is_deleted (BOOLEAN, DEFAULT false)
- deleted_at (TIMESTAMP, NULLABLE)
- created_at (TIMESTAMP, DEFAULT NOW())
- updated_at (TIMESTAMP, DEFAULT NOW())

Indexes:
- PRIMARY KEY (id)
- INDEX (user_id)
- INDEX (parent_folder_id)
- INDEX (path)
- INDEX (is_deleted)
```

### files table
```
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → users.id)
- folder_id (UUID, Foreign Key → folders.id, NULLABLE)
- original_name (VARCHAR, NOT NULL)
- stored_name (VARCHAR, hash-based filename, NOT NULL)
- file_path (TEXT, path on disk, NOT NULL)
- file_hash (VARCHAR, SHA256 hash, NOT NULL)
- mime_type (VARCHAR, NOT NULL)
- size (BIGINT, bytes, NOT NULL)
- thumbnail_path (TEXT, NULLABLE)
- preview_path (TEXT, NULLABLE - for future use)
- version (INTEGER, DEFAULT 1)
- parent_file_id (UUID, Foreign Key → files.id, NULLABLE, for versioning)
- upload_status (ENUM: 'uploading', 'completed', 'failed', DEFAULT 'completed')
- is_available (BOOLEAN, DEFAULT true, false during upload)
- is_deleted (BOOLEAN, DEFAULT false)
- deleted_at (TIMESTAMP, NULLABLE)
- created_at (TIMESTAMP, DEFAULT NOW())
- updated_at (TIMESTAMP, DEFAULT NOW())

Indexes:
- PRIMARY KEY (id)
- INDEX (user_id)
- INDEX (folder_id)
- INDEX (file_hash) - for deduplication
- INDEX (parent_file_id)
- INDEX (is_deleted)
- INDEX (created_at)
```

### file_references table (for deduplication)
```
- id (UUID, Primary Key)
- file_hash (VARCHAR, UNIQUE, SHA256 hash)
- stored_path (TEXT, physical file location on disk)
- reference_count (INTEGER, DEFAULT 1, how many files point to this)
- created_at (TIMESTAMP, DEFAULT NOW())

Indexes:
- PRIMARY KEY (id)
- UNIQUE INDEX (file_hash)

Purpose: Multiple file records can point to the same physical file.
When a user uploads a file that already exists (same hash), we increment
reference_count and create a new file record pointing to existing physical file.
When deleting, decrement reference_count. Only delete physical file when count = 0.
```

### shared_links table
```
- id (UUID, Primary Key)
- file_id (UUID, Foreign Key → files.id)
- created_by_user_id (UUID, Foreign Key → users.id)
- token (VARCHAR, UNIQUE, random string for URL)
- password_hash (VARCHAR, NULLABLE)
- expires_at (TIMESTAMP, NULLABLE, NULL = never expires)
- max_downloads (INTEGER, NULLABLE, NULL = unlimited)
- download_count (INTEGER, DEFAULT 0)
- allow_preview (BOOLEAN, DEFAULT true)
- is_active (BOOLEAN, DEFAULT true)
- created_at (TIMESTAMP, DEFAULT NOW())
- last_accessed_at (TIMESTAMP, NULLABLE)

Indexes:
- PRIMARY KEY (id)
- UNIQUE INDEX (token)
- INDEX (file_id)
- INDEX (created_by_user_id)
- INDEX (expires_at)
- INDEX (is_active)
```

### activity_logs table
```
- id (BIGSERIAL, Primary Key)
- user_id (UUID, Foreign Key → users.id, NULLABLE for public access)
- file_id (UUID, Foreign Key → files.id, NULLABLE)
- action (ENUM: 'upload', 'download', 'delete', 'share', 'view', 'restore', 'create_user', 'login')
- ip_address (VARCHAR, NULLABLE)
- user_agent (TEXT, NULLABLE)
- details (JSONB, additional info, NULLABLE)
- created_at (TIMESTAMP, DEFAULT NOW())

Indexes:
- PRIMARY KEY (id)
- INDEX (user_id)
- INDEX (file_id)
- INDEX (action)
- INDEX (created_at)
```

### sessions table (if using database sessions instead of pure JWT)
```
Optional - JWT with Redis might be sufficient
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → users.id)
- token (VARCHAR, UNIQUE)
- refresh_token (VARCHAR, UNIQUE)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP, DEFAULT NOW())
```

---

## File Storage Strategy

### Hash-Based Storage with Metadata Database (RECOMMENDED)

**Directory Structure:**
```
/storage/
├── files/                    # Actual file storage (hash-based)
│   ├── ab/
│   │   ├── cd/
│   │   │   ├── abcdef123456789...xyz.jpg
│   │   │   └── abcdef987654321...xyz.pdf
│   │   └── ef/
│   │       └── abefgh123456789...xyz.mp4
│   ├── 12/
│   │   └── 34/
│   │       └── 123456789abcdef...xyz.zip
│   └── ...
│
├── thumbnails/               # Generated thumbnails
│   ├── ab/
│   │   └── cd/
│   │       ├── abcdef123456789...xyz_thumb.jpg
│   │       └── abcdef123456789...xyz_thumb.gif (animated for video)
│   └── ...
│
└── temp/                     # Temporary upload chunks
    ├── upload_session_uuid_1/
    │   ├── chunk_0
    │   ├── chunk_1
    │   └── ...
    └── ...
```

**Storage Logic:**

1. **File Upload:**
   - Calculate SHA256 hash of entire file
   - Use first 2 chars of hash for level-1 directory (ab/)
   - Use next 2 chars for level-2 directory (cd/)
   - Store file as: `/ab/cd/{full_hash}.{extension}`

2. **Why 2-level directory structure:**
   - Prevents huge directory listings (filesystem performance)
   - Example: 1 million files distributed across 65,536 directories (256 × 256)
   - Each directory has ~15 files on average

3. **Deduplication:**
   - Before storing, check if file_hash exists in file_references table
   - If exists: Don't store new file, link to existing physical file, increment reference_count
   - If new: Store physical file, create file_references entry
   - Result: Same file uploaded by 2 users = stored once on disk

4. **Database stores:**
   - file_id: UUID
   - user_id: Who owns this file
   - original_name: "vacation_photo.jpg"
   - stored_name: "abcdef123456789...xyz.jpg"
   - file_path: "/ab/cd/abcdef123456789...xyz.jpg"
   - file_hash: "abcdef123456789...xyz"
   - mime_type: "image/jpeg"
   - size: 2048576 bytes
   - thumbnail_path: "/ab/cd/abcdef123456789...xyz_thumb.jpg"
   - created_at, updated_at, etc.

5. **Benefits:**
   - Deduplication (save storage space)
   - No filename conflicts (hash-based naming)
   - Better performance (distributed across directories)
   - Secure (users can't guess other people's file paths)
   - Scalability (easy to move files to different disks/servers later)
   - Flexible metadata (tag files, share them, create albums without moving files)

---

## API Endpoints (RESTful v1)

### Authentication Endpoints
```
POST   /api/v1/auth/register
Description: Admin only - create new user
Body: { username, email, password, role, storage_quota }
Response: { user, message }

POST   /api/v1/auth/login
Description: Login with email + password
Body: { email, password }
Response: { token, refreshToken, user, requires2FA: boolean }

POST   /api/v1/auth/verify-2fa
Description: Verify 2FA token after login
Body: { email, token }
Response: { token, refreshToken, user }

POST   /api/v1/auth/setup-2fa
Description: Setup 2FA (returns QR code)
Headers: Authorization: Bearer <token>
Response: { secret, qrCode, backupCodes }

POST   /api/v1/auth/enable-2fa
Description: Enable 2FA after verification
Headers: Authorization: Bearer <token>
Body: { token }
Response: { success, backupCodes }

POST   /api/v1/auth/disable-2fa
Description: Disable 2FA
Headers: Authorization: Bearer <token>
Body: { token }
Response: { success }

POST   /api/v1/auth/refresh
Description: Refresh JWT token
Body: { refreshToken }
Response: { token, refreshToken }

POST   /api/v1/auth/logout
Description: Logout (invalidate tokens)
Headers: Authorization: Bearer <token>
Response: { message }
```

### User Management Endpoints (Admin Only)
```
GET    /api/v1/users
Description: List all users
Headers: Authorization: Bearer <token>
Query: ?page=1&limit=50
Response: { users[], pagination }

POST   /api/v1/users
Description: Create new user
Headers: Authorization: Bearer <token>
Body: { username, email, password, role, storage_quota }
Response: { user, message }

GET    /api/v1/users/:id
Description: Get user details
Headers: Authorization: Bearer <token>
Response: { user, storage_stats }

PUT    /api/v1/users/:id
Description: Update user
Headers: Authorization: Bearer <token>
Body: { username?, email?, role?, storage_quota? }
Response: { user, message }

DELETE /api/v1/users/:id
Description: Delete user
Headers: Authorization: Bearer <token>
Response: { message }

GET    /api/v1/users/:id/storage
Description: Get user's storage usage details
Headers: Authorization: Bearer <token>
Response: { quota, used, available, fileCount, breakdown }
```

### Folder Endpoints
```
GET    /api/v1/folders
Description: List user's folders
Headers: Authorization: Bearer <token>
Query: ?parent_id=<uuid>&include_deleted=false
Response: { folders[] }

POST   /api/v1/folders
Description: Create new folder
Headers: Authorization: Bearer <token>
Body: { name, parent_folder_id? }
Response: { folder }

GET    /api/v1/folders/:id
Description: Get folder contents (files and subfolders)
Headers: Authorization: Bearer <token>
Query: ?page=1&limit=50&sort=name&order=asc
Response: { folder, files[], subfolders[], pagination }

PUT    /api/v1/folders/:id
Description: Rename folder or move to different parent
Headers: Authorization: Bearer <token>
Body: { name?, parent_folder_id? }
Response: { folder }

DELETE /api/v1/folders/:id
Description: Delete folder (move to trash with all contents)
Headers: Authorization: Bearer <token>
Response: { message }

POST   /api/v1/folders/:id/restore
Description: Restore folder from trash
Headers: Authorization: Bearer <token>
Response: { folder }
```

### File Endpoints
```
POST   /api/v1/files/upload
Description: Upload file (single upload for small files)
Headers: Authorization: Bearer <token>
Body: multipart/form-data { file, folder_id?, file_hash }
Response: { file, message }

POST   /api/v1/files/upload/init
Description: Initialize chunked upload for large files
Headers: Authorization: Bearer <token>
Body: { filename, file_size, file_hash, mime_type, total_chunks, folder_id? }
Response: { upload_session_id, chunk_size }

POST   /api/v1/files/upload/chunk
Description: Upload single chunk
Headers: Authorization: Bearer <token>
Body: multipart/form-data { upload_session_id, chunk_index, chunk }
Response: { chunk_index, received, total_chunks }

POST   /api/v1/files/upload/complete
Description: Finalize chunked upload
Headers: Authorization: Bearer <token>
Body: { upload_session_id, file_hash }
Response: { file, message }

POST   /api/v1/files/upload/cancel
Description: Cancel chunked upload
Headers: Authorization: Bearer <token>
Body: { upload_session_id }
Response: { message }

POST   /api/v1/files/check-duplicate
Description: Check if file exists before uploading (pre-upload duplicate detection)
Headers: Authorization: Bearer <token>
Body: { file_hash, file_size, filename, mime_type }
Response: { exists: boolean, file_id?: uuid, message }

GET    /api/v1/files/upload/status/:session_id
Description: Get upload session status (for resumable uploads)
Headers: Authorization: Bearer <token>
Response: { session_id, chunks_received: [], chunks_missing: [], total_chunks, expires_at }

POST   /api/v1/files/upload/resume
Description: Resume interrupted upload from last successful chunk
Headers: Authorization: Bearer <token>
Body: { upload_session_id }
Response: { session_id, chunks_missing: [], next_chunk_index }

GET    /api/v1/files
Description: List user's files
Headers: Authorization: Bearer <token>
Query: ?folder_id=<uuid>&page=1&limit=50&sort=name&order=asc&search=<query>&type=<mime>&from_date=<iso>&to_date=<iso>
Response: { files[], pagination, total }

GET    /api/v1/files/:id
Description: Get file metadata
Headers: Authorization: Bearer <token>
Response: { file, versions[], shared_links[] }

GET    /api/v1/files/:id/download
Description: Download file
Headers: Authorization: Bearer <token>
Response: File stream with appropriate headers

GET    /api/v1/files/:id/thumbnail
Description: Get file thumbnail
Headers: Authorization: Bearer <token>
Response: Image stream

GET    /api/v1/files/:id/versions
Description: Get file version history
Headers: Authorization: Bearer <token>
Response: { versions[] }

GET    /api/v1/files/:id/versions/:version_id/download
Description: Download specific version
Headers: Authorization: Bearer <token>
Response: File stream

PUT    /api/v1/files/:id
Description: Update file metadata (rename, move to folder)
Headers: Authorization: Bearer <token>
Body: { original_name?, folder_id? }
Response: { file }

DELETE /api/v1/files/:id
Description: Soft delete (move to trash)
Headers: Authorization: Bearer <token>
Response: { message }

POST   /api/v1/files/:id/restore
Description: Restore from trash
Headers: Authorization: Bearer <token>
Response: { file }

POST   /api/v1/files/bulk-download
Description: Download multiple files as ZIP
Headers: Authorization: Bearer <token>
Body: { file_ids[] }
Response: ZIP file stream

POST   /api/v1/files/bulk-delete
Description: Bulk delete (move to trash)
Headers: Authorization: Bearer <token>
Body: { file_ids[] }
Response: { deleted_count }

POST   /api/v1/files/bulk-move
Description: Bulk move to folder
Headers: Authorization: Bearer <token>
Body: { file_ids[], folder_id }
Response: { moved_count }
```

### Shared Links Endpoints
```
POST   /api/v1/share
Description: Create shareable link
Headers: Authorization: Bearer <token>
Body: { file_id, password?, expires_at?, max_downloads?, allow_preview }
Response: { shared_link, public_url }

GET    /api/v1/share/:token
Description: Get file info via share link (public, no auth)
Response: { file_info, requires_password, expired, downloads_remaining }

GET    /api/v1/share/:token/preview
Description: Get file preview/thumbnail via share link (public)
Query: ?password=<pass> (if protected)
Response: Image stream

GET    /api/v1/share/:token/download
Description: Download file via share link (public)
Query: ?password=<pass> (if protected)
Response: File stream (increments download_count)

POST   /api/v1/share/:token/verify-password
Description: Verify password for protected link
Body: { password }
Response: { valid, file_info? }

GET    /api/v1/share/my-links
Description: List current user's shared links
Headers: Authorization: Bearer <token>
Query: ?page=1&limit=50&active_only=true
Response: { shared_links[], pagination }

PUT    /api/v1/share/:id
Description: Update share link settings
Headers: Authorization: Bearer <token>
Body: { expires_at?, max_downloads?, is_active?, password? }
Response: { shared_link }

DELETE /api/v1/share/:id
Description: Delete/deactivate share link
Headers: Authorization: Bearer <token>
Response: { message }
```

### Trash Endpoints
```
GET    /api/v1/trash
Description: List deleted files and folders
Headers: Authorization: Bearer <token>
Query: ?page=1&limit=50&type=<file|folder>
Response: { items[], pagination }

POST   /api/v1/trash/:id/restore
Description: Restore item from trash
Headers: Authorization: Bearer <token>
Response: { item }

DELETE /api/v1/trash/:id
Description: Permanently delete item
Headers: Authorization: Bearer <token>
Response: { message }

DELETE /api/v1/trash/empty
Description: Empty entire trash (permanent delete all)
Headers: Authorization: Bearer <token>
Response: { deleted_count }
```

### Activity Log Endpoints
```
GET    /api/v1/activity
Description: Get activity logs
Headers: Authorization: Bearer <token>
Query: ?page=1&limit=50&action=<type>&from_date=<iso>&to_date=<iso>&user_id=<uuid>
Response: { activities[], pagination }

GET    /api/v1/activity/file/:id
Description: Get activity for specific file
Headers: Authorization: Bearer <token>
Response: { activities[] }
```

### Search Endpoint
```
GET    /api/v1/search
Description: Search files
Headers: Authorization: Bearer <token>
Query: ?q=<query>&type=<mime>&from_date=<iso>&to_date=<iso>&folder_id=<uuid>&page=1&limit=50
Response: { files[], pagination }
```

### Storage Stats Endpoint
```
GET    /api/v1/storage/stats
Description: Get current user's storage usage
Headers: Authorization: Bearer <token>
Response: { quota, used, available, file_count, breakdown_by_type }
```

---

## Project Structure

```
file-server/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js         # PostgreSQL connection config
│   │   │   ├── redis.js            # Redis connection config
│   │   │   └── constants.js        # App constants (file size limits, etc.)
│   │   │
│   │   ├── models/                 # Database models (Sequelize or Prisma)
│   │   │   ├── User.js
│   │   │   ├── File.js
│   │   │   ├── Folder.js
│   │   │   ├── FileReference.js    # For deduplication
│   │   │   ├── SharedLink.js
│   │   │   ├── ActivityLog.js
│   │   │   └── index.js            # Model associations
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js   # Login, register, 2FA, logout
│   │   │   ├── fileController.js   # Upload, download, list, delete
│   │   │   ├── folderController.js # Folder CRUD operations
│   │   │   ├── shareController.js  # Shareable links management
│   │   │   ├── userController.js   # User management (admin)
│   │   │   ├── trashController.js  # Trash bin operations
│   │   │   ├── activityController.js # Activity logs
│   │   │   └── searchController.js # Search functionality
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js             # JWT verification
│   │   │   ├── adminOnly.js        # Admin permission check
│   │   │   ├── rateLimiter.js      # Rate limiting
│   │   │   ├── upload.js           # Multer config (chunked upload)
│   │   │   ├── validators.js       # Request validation middleware
│   │   │   └── errorHandler.js     # Global error handler
│   │   │
│   │   ├── services/
│   │   │   ├── fileService.js      # File operations business logic
│   │   │   ├── storageService.js   # Hash-based storage management
│   │   │   ├── deduplicationService.js # File deduplication logic
│   │   │   ├── thumbnailService.js # Thumbnail generation (Sharp/FFmpeg)
│   │   │   ├── zipService.js       # Bulk download ZIP creation
│   │   │   ├── versionService.js   # File versioning logic
│   │   │   ├── activityService.js  # Activity logging
│   │   │   ├── quotaService.js     # Storage quota management
│   │   │   └── shareLinkService.js # Share link logic
│   │   │
│   │   ├── jobs/
│   │   │   ├── queues.js           # BullMQ queue setup
│   │   │   ├── workers/
│   │   │   │   ├── thumbnailWorker.js  # Thumbnail generation worker
│   │   │   │   ├── cleanupWorker.js    # Cleanup trash after 30 days
│   │   │   │   └── backupWorker.js     # Database backup job
│   │   │   └── processors/
│   │   │       ├── imageThumbnail.js   # Image thumbnail logic
│   │   │       ├── videoThumbnail.js   # Video animated thumbnail
│   │   │       └── pdfThumbnail.js     # PDF first page thumbnail
│   │   │
│   │   ├── routes/
│   │   │   ├── api/
│   │   │   │   └── v1/
│   │   │   │       ├── auth.js         # Auth routes
│   │   │   │       ├── files.js        # File routes
│   │   │   │       ├── folders.js      # Folder routes
│   │   │   │       ├── share.js        # Share link routes
│   │   │   │       ├── users.js        # User management routes
│   │   │   │       ├── trash.js        # Trash routes
│   │   │   │       ├── activity.js     # Activity log routes
│   │   │   │       ├── search.js       # Search routes
│   │   │   │       └── storage.js      # Storage stats routes
│   │   │   └── index.js                # Main router
│   │   │
│   │   ├── utils/
│   │   │   ├── hashGenerator.js    # SHA256 for files and storage paths
│   │   │   ├── tokenGenerator.js   # Share link secure tokens
│   │   │   ├── logger.js           # Winston logger configuration
│   │   │   ├── validators.js       # Input validation helpers
│   │   │   └── fileHelpers.js      # File utility functions
│   │   │
│   │   ├── app.js                  # Express app setup
│   │   └── server.js               # Server entry point
│   │
│   ├── storage/                    # File storage root
│   │   ├── files/                  # Hash-based file storage
│   │   │   ├── ab/
│   │   │   │   └── cd/
│   │   │   │       └── abcdef123...
│   │   │   └── ...
│   │   ├── thumbnails/             # Generated thumbnails
│   │   └── temp/                   # Temporary upload chunks
│   │
│   ├── backups/                    # Database backups
│   ├── logs/                       # Application logs
│   ├── package.json
│   ├── .env                        # Environment variables
│   └── ecosystem.config.js         # PM2 configuration
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   ├── TwoFactorSetup.jsx
│   │   │   │   └── TwoFactorVerify.jsx
│   │   │   │
│   │   │   ├── file/
│   │   │   │   ├── FileUpload.jsx       # Drag-drop + chunked upload
│   │   │   │   ├── FileList.jsx         # Grid/List view
│   │   │   │   ├── FileCard.jsx         # Single file card
│   │   │   │   ├── FilePreview.jsx      # File preview modal
│   │   │   │   ├── FileActions.jsx      # Action buttons (download, share, delete)
│   │   │   │   ├── BulkActions.jsx      # Bulk selection toolbar
│   │   │   │   ├── FileVersionHistory.jsx
│   │   │   │   └── UploadProgress.jsx   # Upload progress indicator
│   │   │   │
│   │   │   ├── folder/
│   │   │   │   ├── FolderTree.jsx       # Sidebar folder tree
│   │   │   │   ├── FolderBreadcrumb.jsx # Current path breadcrumb
│   │   │   │   └── CreateFolderModal.jsx
│   │   │   │
│   │   │   ├── share/
│   │   │   │   ├── CreateShareLink.jsx  # Share link creation modal
│   │   │   │   ├── ShareLinkList.jsx    # User's active share links
│   │   │   │   ├── PublicFileView.jsx   # Public view for shared links
│   │   │   │   └── PasswordPrompt.jsx   # Password input for protected links
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── UserManagement.jsx   # Admin user CRUD
│   │   │   │   ├── ActivityLogs.jsx     # Activity log viewer
│   │   │   │   ├── CreateUserModal.jsx
│   │   │   │   └── StorageOverview.jsx  # System-wide storage stats
│   │   │   │
│   │   │   ├── trash/
│   │   │   │   ├── TrashList.jsx        # Deleted files list
│   │   │   │   └── RestoreConfirm.jsx   # Restore confirmation
│   │   │   │
│   │   │   ├── common/
│   │   │   │   ├── SearchBar.jsx
│   │   │   │   ├── SortDropdown.jsx
│   │   │   │   ├── FilterPanel.jsx
│   │   │   │   ├── Pagination.jsx
│   │   │   │   ├── ViewToggle.jsx       # Grid/List toggle button
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── ErrorMessage.jsx
│   │   │   │   └── ConfirmDialog.jsx
│   │   │   │
│   │   │   └── layout/
│   │   │       ├── Header.jsx           # Top navigation bar
│   │   │       ├── Sidebar.jsx          # Left sidebar (folders, navigation)
│   │   │       ├── Layout.jsx           # Main layout wrapper
│   │   │       └── StorageIndicator.jsx # Storage usage indicator
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.jsx                # Login page
│   │   │   ├── Dashboard.jsx            # Main dashboard/home
│   │   │   ├── Files.jsx                # File browser page
│   │   │   ├── Trash.jsx                # Trash bin page
│   │   │   ├── SharedFiles.jsx          # User's shared links page
│   │   │   ├── SharedView.jsx           # Public shared file view
│   │   │   ├── Settings.jsx             # User settings (2FA, etc.)
│   │   │   └── Admin.jsx                # Admin panel
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js               # Authentication hook
│   │   │   ├── useFiles.js              # File operations hook
│   │   │   ├── useUpload.js             # Chunked upload hook
│   │   │   ├── useFolders.js            # Folder operations hook
│   │   │   └── useDebounce.js           # Debounce hook for search
│   │   │
│   │   ├── services/
│   │   │   └── api.js                   # Axios instance + interceptors
│   │   │
│   │   ├── utils/
│   │   │   ├── formatters.js            # File size, date formatting
│   │   │   ├── chunkUpload.js           # Client-side chunking logic
│   │   │   ├── fileHelpers.js           # File type icons, etc.
│   │   │   └── validators.js            # Client-side validation
│   │   │
│   │   ├── store/                       # State management (Zustand/Context)
│   │   │   ├── authStore.js
│   │   │   ├── fileStore.js
│   │   │   └── uiStore.js               # UI state (grid/list view, etc.)
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css              # Global Tailwind styles
│   │   │
│   │   ├── App.jsx                      # Main App component
│   │   └── main.jsx                     # Entry point
│   │
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   └── .env                             # Frontend env variables
│
├── nginx/
│   └── file-server.conf                 # nginx configuration
│
├── scripts/
│   ├── setup-termux.sh                  # Initial Termux setup
│   ├── install-dependencies.sh          # Install all dependencies
│   ├── setup-postgresql.sh              # PostgreSQL setup
│   ├── setup-redis.sh                   # Redis setup
│   ├── setup-nginx.sh                   # nginx setup
│   ├── setup-duckdns.sh                 # DuckDNS configuration
│   ├── setup-ssl.sh                     # Certbot SSL setup
│   ├── startup.sh                       # Auto-start script (all services)
│   ├── backup-db.sh                     # Manual DB backup script
│   └── restore-db.sh                    # Restore from backup
│
├── docs/
│   ├── SETUP.md                         # Complete setup guide
│   ├── API.md                           # API documentation
│   ├── DEPLOYMENT.md                    # Deployment instructions for Android
│   └── ARCHITECTURE.md                  # Architecture overview
│
├── .gitignore
└── README.md
```

---

## Security Features

### Authentication & Authorization
1. **JWT-based authentication** with access and refresh tokens
2. **2FA (TOTP)** using speakeasy library
   - QR code generation for authenticator apps
   - Backup codes provided during setup
   - Optional but recommended for all users
3. **Password hashing** with bcrypt (12 salt rounds)
4. **Role-based access control** (admin vs regular user)

### HTTP Security
5. **Helmet.js** for security headers
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security
   - Content-Security-Policy
6. **CORS** properly configured (whitelist frontend domain)
7. **HTTPS only** via nginx + Let's Encrypt
8. **Rate limiting** per user/IP using express-rate-limit
   - Auth endpoints: 5 requests per 15 minutes
   - File upload: 100 requests per hour per user
   - File download: 500 requests per hour per user
   - API general: 1000 requests per 15 minutes

### File Security
9. **File hash verification** (SHA256) on upload to prevent tampering
10. **Secure file paths** (hash-based, unpredictable)
11. **MIME type validation** (check actual file content, not just extension)
12. **File size limits** enforced (100GB max)
13. **Storage quota enforcement** per user

### Share Link Security
14. **Cryptographically secure random tokens** for share links (32+ chars)
15. **Optional password protection** for links (bcrypt hashed)
16. **Expiration time** enforcement
17. **Download limit** tracking and enforcement
18. **No directory listing** or path traversal possible

### Database Security
19. **SQL injection protection** (using ORM with parameterized queries)
20. **Prepared statements** for all queries
21. **Database connection pooling** with secure credentials

### Input Validation
22. **All inputs validated** and sanitized
23. **File upload validation** (size, type, content)
24. **XSS protection** via proper escaping and CSP headers

### Session Management
25. **JWT expiration** (access token: 15 mins, refresh token: 7 days)
26. **Token invalidation** on logout
27. **Session tracking** in activity logs

### Audit & Monitoring
28. **Activity logging** for all file operations
29. **Failed login tracking** (logged but no auto-lock)
30. **IP address and user agent logging**
31. **Security event logging** (Winston logger)

---

## Background Jobs

### Job Queue Configuration
- **Queue System**: BullMQ (requires Redis)
- **Priority**: No priority queue (simple FIFO - first in, first out)
- **Concurrency**: 2-3 workers running in parallel (based on phone CPU)
- **Retry Strategy**: 3 attempts with exponential backoff

### Job Types

#### 1. Thumbnail Generation Job
```
Job Name: thumbnail-generation
Trigger: After file upload completes
Input: { file_id, file_path, mime_type }
Process:
  - Image: Generate 150x150 thumb (Sharp)
  - Video: Extract frames and create animated GIF (FFmpeg)
  - PDF: Convert first page to image (pdf-poppler)
Output: Save thumbnail to thumbnails/ directory, update file record
Retry: 3 times
Timeout: 5 minutes per job
```

#### 2. Trash Cleanup Job
```
Job Name: trash-cleanup
Trigger: Scheduled (daily at 2 AM)
Process:
  - Find files/folders with is_deleted=true AND deleted_at < 30 days ago
  - For each file:
    * Decrement reference count in file_references
    * If reference_count = 0: delete physical file
  - Delete file records and folder records
  - Delete associated thumbnails
Output: Log deleted items count
Retry: 1 time
```

#### 3. Database Backup Job
```
Job Name: database-backup
Trigger: Scheduled (daily at 3 AM)
Process:
  - Run pg_dump to create backup file
  - Compress backup (gzip)
  - Save to backups/ directory with timestamp
  - Keep only last 7 days of backups
  - Optional: Upload to external storage (future)
Output: Backup file path
Retry: 2 times
```

#### 4. Storage Calculation Job
```
Job Name: storage-recalculation
Trigger: Scheduled (hourly)
Process:
  - For each user:
    * Calculate sum of all non-deleted file sizes
    * Update users.storage_used field
  - Ensures quota enforcement accuracy
Output: Updated user storage stats
Retry: 2 times
```

#### 5. Share Link Expiration Check
```
Job Name: expire-share-links
Trigger: Scheduled (every 15 minutes)
Process:
  - Find shared_links where expires_at < NOW() AND is_active=true
  - Set is_active=false for expired links
Output: Count of expired links
Retry: 1 time
```

#### 6. Incomplete Upload Cleanup
```
Job Name: cleanup-incomplete-uploads
Trigger: Scheduled (daily at 4 AM)
Process:
  - Find upload sessions in Redis older than 24 hours
  - Find files with upload_status='uploading' AND created_at > 24 hours
  - For each incomplete upload:
    * Delete temp chunks from storage/temp/
    * Update file record: upload_status='failed', is_available=false
    * Clean up Redis session
  - Log cleanup statistics
Output: Count of cleaned sessions and temp files deleted
Retry: 2 times
```

#### 7. Orphaned File Cleanup (Optional)
```
Job Name: cleanup-orphaned-files
Trigger: Scheduled (weekly, Sunday 3 AM)
Process:
  - Scan storage/files/ directory
  - Find physical files not referenced in file_references table
  - Delete orphaned files (from incomplete uploads, etc.)
Output: List of deleted files
Retry: 1 time
```

---

## File Upload Flow (Chunked Upload)

### For Large Files (>100MB)

**Frontend Process:**
```
1. User selects file (e.g., 10GB video)
2. Calculate SHA256 hash of entire file (Web Crypto API)
3. PRE-UPLOAD DUPLICATE CHECK:
   - Call /api/v1/files/check-duplicate
   - Send: file_hash, file_size, filename, mime_type
   - If exists: Skip upload, link to existing file (instant!)
   - If not exists: Proceed with upload
4. Split file into 100MB chunks (using Blob.slice())
5. Call /api/v1/files/upload/init
   - Send: filename, file_size, file_hash, mime_type, total_chunks, folder_id
   - Receive: upload_session_id, chunk_size, chunks_already_received (for resume)
6. For each chunk (parallel or sequential):
   - Skip chunks already received (resumable upload)
   - Upload chunk to /api/v1/files/upload/chunk
   - Send: upload_session_id, chunk_index, chunk_data
   - Update progress bar: (chunks_uploaded / total_chunks) * 100%
   - On connection error: Save session_id, retry later
7. RESUME CAPABILITY (if interrupted):
   - Call /api/v1/files/upload/status/:session_id
   - Get chunks_received and chunks_missing
   - Resume from first missing chunk
8. After all chunks uploaded:
   - Call /api/v1/files/upload/complete
   - Send: upload_session_id, file_hash
9. Backend processes:
   - Verifies all chunks received
   - Reassembles file
   - Verifies hash
   - Checks for duplicates
   - Stores file
   - Updates upload_status to 'completed'
   - Sets is_available to true
   - Queues thumbnail job
10. Frontend receives:
    - Success response with file metadata
    - Display file in file list
```

**Backend Process:**
```
POST /api/v1/files/check-duplicate:
  - Check if file_hash exists in file_references table
  - If exists:
    * Create file record for current user (links to existing physical file)
    * Increment reference_count
    * Update user's storage_used
    * Return { exists: true, file_id, message: "File already exists, linked to your account" }
  - If not exists:
    * Return { exists: false, message: "Proceed with upload" }

POST /api/v1/files/upload/init:
  - Validate user has storage quota available
  - Check if upload_session_id already exists (resume scenario)
  - If existing session found:
    * Return existing session with chunks_received
    * Allow resume from last successful chunk
  - If new upload:
    * Check if file_hash already exists (deduplication check)
    * If exists: Return existing file_id (instant "upload")
    * If new:
      - Generate upload_session_id (UUID)
      - Create temp directory: storage/temp/{upload_session_id}/
      - Store session metadata in Redis (TTL: 24 hours):
        {
          user_id, filename, file_size, file_hash,
          total_chunks, chunks_received: [],
          chunks_missing: [0,1,2,...],
          created_at, expires_at (24 hours)
        }
      - Create file record with upload_status='uploading', is_available=false
  - Return { upload_session_id, chunk_size, chunks_already_received }

GET /api/v1/files/upload/status/:session_id:
  - Retrieve session from Redis
  - If not found: Return 404 (expired or invalid)
  - Return { session_id, chunks_received, chunks_missing, total_chunks, expires_at }

POST /api/v1/files/upload/chunk:
  - Validate upload_session_id exists in Redis
  - Validate chunk_index < total_chunks
  - Check if chunk already received (skip if resuming)
  - Save chunk to: storage/temp/{upload_session_id}/chunk_{index}
  - Update Redis: Mark chunk_index as received, remove from chunks_missing
  - Extend session TTL (reset 24-hour timer on activity)
  - Return { chunk_index, received, total_chunks, chunks_remaining }

POST /api/v1/files/upload/complete:
  - Validate all chunks received (check Redis)
  - Concatenate chunks in order:
    for i in 0..total_chunks:
      append chunk_i to final_file
  - Calculate SHA256 of final file
  - Verify hash matches provided file_hash
  - If mismatch: 
    * Mark upload_status='failed'
    * Return error, cleanup temp files
    * Keep file record for debugging
  - If match:
    * Check file_references table for existing hash
    * If duplicate:
      - Link to existing physical file
      - Increment reference_count
      - Delete newly uploaded file
    * If unique:
      - Generate storage path (hash-based)
      - Move file to storage/files/{ab}/{cd}/{hash}.{ext}
      - Create file_references entry
    * Update file record:
      - upload_status='completed'
      - is_available=true
    * Update user's storage_used
    * Queue thumbnail generation job
    * Cleanup temp directory and Redis session
  - Return file metadata
```

### For Small Files (<100MB)

```
POST /api/v1/files/upload:
  - Direct multipart upload
  - Calculate hash
  - Check for duplicates
  - Store file
  - Queue thumbnail job
  - Return file metadata
```

---

## Preview/Thumbnail Generation Details

### Image Thumbnails (Always Generate)
```
Library: Sharp
Process:
  - Input: Original image file
  - Generate: 150x150px thumbnail (for grid view)
  - Optional: 800x600px preview (for larger preview - future)
  - Format: JPEG (quality: 85%)
  - Preserve aspect ratio with cover fit
  - Save to: storage/thumbnails/{hash_path}_thumb.jpg
Supported: JPG, PNG, GIF, WebP, TIFF, etc.
Timing: Background job (BullMQ), asynchronous
```

### Video Thumbnails (Animated)
```
Library: FFmpeg
Process:
  - Extract frames at intervals: 0.5s, 1s, 1.5s, 2s (4 frames total)
  - Resize each frame to 150x150px
  - Create animated GIF from frames
  - FPS: 1 frame per second (4 frames = 4 second loop)
  - Save to: storage/thumbnails/{hash_path}_thumb.gif
Supported: MP4, WebM, AVI, MOV, MKV, etc.
Timing: Background job (can take 10-30 seconds for large videos)
Fallback: If FFmpeg fails, use first frame as static image
```

### PDF Thumbnails (First Page Only)
```
Library: pdf-poppler or pdf2pic
Process:
  - Extract first page
  - Convert to image (PNG or JPEG)
  - Resize to 150x200px (preserve document aspect)
  - Save to: storage/thumbnails/{hash_path}_thumb.jpg
Timing: Background job
Fallback: Generic PDF icon if conversion fails
```

### Other File Types
```
Process:
  - No thumbnail generation
  - Frontend displays icon based on mime type
  - Icons for: Documents (Word, Excel), Archives (ZIP, RAR),
    Audio files, Text files, etc.
```

### Thumbnail Generation Priority
```
1. Small images (<5MB): Process immediately (fast)
2. Large images, PDFs: Queue job (medium priority)
3. Videos: Queue job (can be slow)
4. If thumbnail generation fails: Log error, set thumbnail_path = NULL,
   frontend shows generic icon
```

---

## Networking & Deployment

### Internet Access Strategy: Port Forwarding + DDNS

#### Components:
1. **DuckDNS** - Free dynamic DNS service
2. **Router Port Forwarding** - Forward port 443 to Android phone
3. **nginx** - Reverse proxy and SSL termination
4. **Certbot** - Free SSL certificate from Let's Encrypt

#### Setup Process:

**Step 1: DuckDNS Setup**
```
1. Sign up at duckdns.org (free)
2. Choose subdomain: yourname.duckdns.org
3. Get token from DuckDNS dashboard
4. Install DuckDNS updater on phone (via Termux):
   - curl "https://www.duckdns.org/update?domains=yourname&token=YOUR_TOKEN&ip=" | cron
   - Run every 5 minutes (cron job) to update IP
5. Your domain always points to your current home IP
```

**Step 2: Find Phone's Local IP**
```
In Termux:
  ip addr show wlan0
  
Example output: 192.168.1.50 (your phone's local IP)

Make this IP static:
  - Go to router admin panel
  - Find DHCP settings
  - Reserve IP for phone's MAC address
  - Ensures phone always gets same local IP
```

**Step 3: Router Port Forwarding**
```
Access router admin panel (usually 192.168.1.1 or 192.168.0.1)
Navigate to: Port Forwarding / Virtual Server / NAT settings

Add rule:
  - External Port: 443 (HTTPS)
  - Internal IP: 192.168.1.50 (your phone)
  - Internal Port: 443
  - Protocol: TCP
  - Save and reboot router

Add another rule for HTTP→HTTPS redirect:
  - External Port: 80 (HTTP)
  - Internal IP: 192.168.1.50
  - Internal Port: 80
  - Protocol: TCP

Test: Visit https://yourname.duckdns.org from external network
```

**Step 4: nginx Configuration**
```
File: /etc/nginx/sites-available/file-server

server {
    listen 80;
    server_name yourname.duckdns.org;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourname.duckdns.org;
    
    # SSL certificates (set up by Certbot)
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Max upload size (100GB)
    client_max_body_size 100G;
    
    # Timeouts for large uploads
    client_body_timeout 3600s;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    
    # Frontend (React build)
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Disable buffering for chunked uploads
        proxy_request_buffering off;
    }
    
    # Static file serving (downloads, thumbnails)
    location /storage/ {
        internal; # Only accessible via X-Accel-Redirect
        alias /path/to/backend/storage/;
    }
}
```

**Step 5: SSL Certificate (Certbot)**
```
Install Certbot in Termux:
  pkg install certbot

Get certificate:
  certbot certonly --standalone -d yourname.duckdns.org
  
  (Stop nginx first: nginx -s stop)
  
Certificates saved to:
  /data/data/com.termux/files/usr/etc/letsencrypt/live/yourname.duckdns.org/

Automatic renewal:
  - Certbot adds cron job automatically
  - Or add to crontab: certbot renew --quiet
  - Runs daily, renews if cert expires in <30 days

Update nginx config with cert paths
Restart nginx: nginx -s reload
```

**Step 6: Test Access**
```
From external network (mobile data, friend's WiFi):
  https://yourname.duckdns.org

Should see:
  - Valid SSL certificate (green lock)
  - React frontend loads
  - Can log in
  - Can upload/download files
```

---

## Termux/Android Setup

### Prerequisites
```
1. Android phone with 200GB storage
2. Install Termux from F-Droid (NOT Play Store - outdated version)
   Download: https://f-droid.org/en/packages/com.termux/
3. Install Termux:Boot (auto-start on phone boot)
4. Phone must stay plugged in 24/7
5. Disable battery optimization for Termux
6. Keep phone on WiFi (not mobile data - costs)
```

### Initial Setup Commands
```bash
# Update packages
pkg update && pkg upgrade

# Install essential packages
pkg install nodejs postgresql redis nginx git ffmpeg imagemagick

# Install build tools
pkg install build-essential python

# Create directory structure
mkdir -p ~/file-server
cd ~/file-server

# Clone/copy project files
# (Transfer from computer via git, USB, or termux-setup-storage + file manager)

# Setup PostgreSQL
pg_ctl -D $PREFIX/var/lib/postgresql init
pg_ctl -D $PREFIX/var/lib/postgresql start
createdb fileserver
psql fileserver -c "CREATE USER fileserver WITH PASSWORD 'secure_password';"
psql fileserver -c "GRANT ALL PRIVILEGES ON DATABASE fileserver TO fileserver;"

# Setup Redis
redis-server --daemonize yes

# Install Node.js dependencies
cd ~/file-server/backend
npm install

cd ~/file-server/frontend
npm install
npm run build

# Copy frontend build to nginx serve location
cp -r dist /path/to/nginx/html/

# Setup environment variables
cp .env.example .env
# Edit .env with actual values
nano .env

# Run database migrations
cd ~/file-server/backend
npm run migrate

# Start backend with PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save

# Start nginx
nginx

# Setup DuckDNS updater
echo "*/5 * * * * curl 'https://www.duckdns.org/update?domains=yourname&token=YOUR_TOKEN&ip=' >/dev/null 2>&1" | crontab -
```

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'file-server-api',
      script: './src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'thumbnail-worker',
      script: './src/jobs/workers/thumbnailWorker.js',
      instances: 2, // 2 concurrent workers
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      autorestart: true
    },
    {
      name: 'cleanup-worker',
      script: './src/jobs/workers/cleanupWorker.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 2 * * *', // Run at 2 AM daily
      autorestart: false
    }
  ]
};
```

### Auto-Start on Boot
```bash
# Install Termux:Boot app from F-Droid

# Create boot script
mkdir -p ~/.termux/boot
nano ~/.termux/boot/start-file-server.sh

# Script content:
#!/data/data/com.termux/files/usr/bin/bash

# Wait for network
sleep 30

# Start PostgreSQL
pg_ctl -D $PREFIX/var/lib/postgresql start

# Start Redis
redis-server --daemonize yes

# Start nginx
nginx

# Start backend with PM2
cd ~/file-server/backend
pm2 resurrect

# Update DuckDNS
curl "https://www.duckdns.org/update?domains=yourname&token=YOUR_TOKEN&ip="

# Make executable
chmod +x ~/.termux/boot/start-file-server.sh

# Test by rebooting phone
```

### Monitoring & Maintenance
```bash
# Check PM2 status
pm2 status
pm2 logs

# Check nginx status
ps aux | grep nginx

# Check PostgreSQL
psql fileserver -c "SELECT version();"

# Check Redis
redis-cli ping

# Check storage usage
df -h

# Check logs
tail -f ~/file-server/backend/logs/app.log
tail -f ~/file-server/backend/logs/pm2-error.log

# Backup database manually
pg_dump fileserver > ~/file-server/backups/backup_$(date +%Y%m%d).sql

# Restart services
pm2 restart all
nginx -s reload
```

---

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)
**Goal**: Basic working system - single file upload/download

Tasks:
1. Project setup (backend + frontend structure)
2. Database setup (PostgreSQL + models)
3. Redis setup
4. Basic JWT authentication (no 2FA yet)
5. User model and admin creation
6. Simple file upload (single file, no chunking yet)
7. File download endpoint
8. File list endpoint with pagination
9. Basic React frontend (login + file list)
10. nginx basic configuration

**Deliverable**: Can log in, upload small file, see it in list, download it

---

### Phase 2: Advanced Upload & Storage (Week 2-3)
**Goal**: Chunked uploads for large files, hash-based storage, deduplication

Tasks:
1. Implement chunked upload (init, chunk, complete endpoints)
2. Frontend chunking logic with progress bar
3. Hash-based storage service
4. Deduplication logic (file_references table)
5. Storage quota enforcement
6. BullMQ queue setup
7. Thumbnail generation workers
   - Image thumbnails (Sharp)
   - Video animated thumbnails (FFmpeg)
   - PDF thumbnails (pdf-poppler)
8. Background job processing

**Deliverable**: Can upload 10GB+ files, automatic thumbnails, deduplication works

---

### Phase 3: File Management (Week 3-4)
**Goal**: Complete file management features

Tasks:
1. Folder creation and organization
2. File versioning system
3. Trash bin (soft delete)
4. Restore from trash
5. Search functionality
6. Sort and filter options
7. Grid view and List view toggle
8. Bulk operations (select multiple, delete, download as ZIP)
9. ZIP service for bulk downloads
10. File rename and move
11. Frontend UI improvements (drag & drop, lazy loading)

**Deliverable**: Full-featured file manager with folders, search, bulk operations

---

### Phase 4: Sharing & Collaboration (Week 4-5)
**Goal**: Shareable public links with controls

Tasks:
1. Share link generation service
2. Token generation (secure random)
3. Optional password protection
4. Expiration time setting
5. Download limit tracking
6. Public file view page (no auth required)
7. Preview before download for public links
8. Share link management (list, edit, delete)
9. Share link expiration job
10. Activity logging for public access

**Deliverable**: Can create shareable links with password, expiry, download limits

---

### Phase 5: Admin & Security (Week 5-6)
**Goal**: Multi-user support, 2FA, admin panel, security hardening

Tasks:
1. 2FA implementation (speakeasy + QR codes)
2. 2FA setup and verification flow
3. User management (admin creates users)
4. Admin panel UI
5. User role permissions
6. Activity logs (comprehensive logging)
7. Activity log viewer (admin)
8. Rate limiting (express-rate-limit)
9. Security headers (helmet)
10. Input validation and sanitization
11. Storage stats per user
12. Admin dashboard (overview of system)

**Deliverable**: Multi-user system with 2FA, admin can manage users, activity tracking

---

### Phase 6: Deployment & Production (Week 6-7)
**Goal**: Deploy to Android phone, internet accessible, production-ready

Tasks:
1. nginx production configuration
2. DuckDNS setup and testing
3. SSL certificate (Certbot)
4. Port forwarding configuration
5. PM2 process management
6. Auto-startup scripts (Termux:Boot)
7. Database backup automation
8. Monitoring and logging setup
9. Performance optimization
10. Security audit
11. Documentation (setup guide, API docs, user manual)
12. Testing on Android/Termux
13. Load testing
14. Final bug fixes and polish

**Deliverable**: Fully deployed, accessible from internet, production-ready system

---

## Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=production
PORT=3000
HOST=localhost

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fileserver
DB_USER=fileserver
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_very_long_random_secret_key_here_min_32_chars
JWT_REFRESH_SECRET=another_very_long_random_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Storage
STORAGE_PATH=/path/to/storage
MAX_FILE_SIZE=107374182400  # 100GB in bytes
CHUNK_SIZE=104857600        # 100MB in bytes

# Thumbnails
THUMBNAIL_SIZE=150
THUMBNAIL_QUALITY=85
VIDEO_THUMBNAIL_FRAMES=4

# URLs
FRONTEND_URL=https://yourname.duckdns.org
BACKEND_URL=https://yourname.duckdns.org/api

# DuckDNS
DUCKDNS_DOMAIN=yourname.duckdns.org
DUCKDNS_TOKEN=your-duckdns-token

# Admin (initial setup)
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this_password_immediately

# Email (optional - for future notifications)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000

# Trash
TRASH_RETENTION_DAYS=30

# Backup
BACKUP_PATH=/path/to/backups
BACKUP_RETENTION_DAYS=7
```

### Frontend (.env)
```bash
VITE_API_URL=https://yourname.duckdns.org/api
VITE_APP_NAME=File Server
VITE_MAX_FILE_SIZE=107374182400
VITE_CHUNK_SIZE=104857600
```

---

## Additional Features & Notes

### Storage Quota Management
```
Admin (role='admin'):
  - storage_quota = NULL (unlimited)
  - Can upload any amount

Regular Users (role='user'):
  - storage_quota = 20GB (20 * 1024 * 1024 * 1024 bytes)
  - Enforced on every upload
  - Check: (storage_used + new_file_size) <= storage_quota
  - If exceeded: Return 403 Forbidden with message

Admin can adjust quota per user via user management panel
```

### File Versioning
```
When uploading file with same name to same folder:
  1. Check if file with same original_name exists in folder
  2. If exists:
     - Keep old file (set parent_file_id = NULL if not set)
     - Create new file record
     - Set new_file.parent_file_id = old_file.id
     - Increment version number: new_file.version = old_file.version + 1
  3. User can:
     - View version history (/api/v1/files/:id/versions)
     - Download specific version
     - Delete specific version (only latest kept by default)
     - Restore older version as new latest
```

### Deduplication Logic
```
On upload complete:
  1. Calculate file_hash (SHA256)
  2. Query file_references table: SELECT * WHERE file_hash = ?
  3. If found:
     - Don't store new physical file
     - Increment reference_count
     - Create file record pointing to existing stored_path
     - User doesn't know (appears as normal upload)
     - Save storage space
  4. If not found:
     - Store physical file
     - Create file_references entry with reference_count = 1
     - Create file record

On delete:
  1. Soft delete file record (is_deleted = true)
  2. After 30 days (trash cleanup job):
     - Decrement reference_count in file_references
     - If reference_count = 0:
       * Delete physical file from disk
       * Delete file_references entry
     - If reference_count > 0:
       * Keep physical file (other users still reference it)
```

### Activity Logging
```
Log all significant actions:
  - User login/logout
  - File upload (file_id, size)
  - File download (file_id, file accessed)
  - File delete/restore
  - Share link created
  - Share link accessed (public, no auth)
  - Folder create/delete
  - User created/deleted (admin action)
  - Settings changed
  - Failed login attempts

Store: user_id, action, ip_address, user_agent, details (JSON)
Admin can view logs filtered by: user, action type, date range
```

### Rate Limiting Strategy
```
Authentication endpoints (POST /api/v1/auth/login):
  - 5 requests per 15 minutes per IP
  - Prevents brute force attacks

File upload (POST /api/v1/files/upload/*):
  - 100 requests per hour per user
  - Prevents abuse

File download (GET /api/v1/files/:id/download):
  - 500 requests per hour per user
  - Allows reasonable usage

General API:
  - 1000 requests per 15 minutes per user
  - Liberal limit for normal usage

Public share links:
  - 100 downloads per hour per IP
  - Prevents bot scraping
```

### Caching Strategy
```
Static files (frontend):
  - Cache-Control: public, max-age=31536000 (1 year)
  - Use hash-based filenames (Vite handles this)

Thumbnails:
  - Cache-Control: public, max-age=2592000 (30 days)
  - ETag support for conditional requests

API responses:
  - No caching (private data)
  - Cache-Control: no-store, must-revalidate

File downloads:
  - Cache-Control: private, max-age=3600 (1 hour)
  - Content-Disposition: attachment; filename="..."
  - Support Range requests (for video streaming, resume downloads)
```

---

## Testing Strategy

### Backend Testing
```
Unit Tests:
  - Service layer logic (file operations, deduplication, etc.)
  - Utility functions (hash generation, token generation)
  - Validation functions

Integration Tests:
  - API endpoints with real database (test DB)
  - File upload/download flows
  - Authentication flows
  - Share link functionality

Load Tests:
  - Concurrent uploads (simulate multiple users)
  - Large file uploads (100GB)
  - Chunked upload reliability
  - Database query performance

Tools:
  - Jest (unit + integration)
  - Supertest (API testing)
  - Artillery or k6 (load testing)
```

### Frontend Testing
```
Unit Tests:
  - Component rendering
  - Hook logic
  - Utility functions

Integration Tests:
  - User flows (login → upload → download → share)
  - Form validation
  - API integration

E2E Tests:
  - Complete user journeys
  - File upload/download
  - Share link access

Tools:
  - Jest + React Testing Library
  - Cypress or Playwright (E2E)
```

---

## Performance Optimization

### Backend
```
1. Database indexing (all foreign keys, frequently queried fields)
2. Connection pooling (PostgreSQL max connections: 10-20)
3. Redis caching for:
   - Upload sessions
   - User sessions (if needed)
   - Frequently accessed data
4. Pagination on all list endpoints (limit: 50)
5. Stream file downloads (don't load entire file in memory)
6. Efficient hashing (stream SHA256, don't load entire file)
7. Background jobs for heavy processing (thumbnails)
8. Cleanup old logs periodically
```

### Frontend
```
1. Code splitting (React.lazy for routes)
2. Image lazy loading
3. Virtual scrolling for large file lists (react-window)
4. Debounced search (useDebounce hook)
5. Optimistic UI updates
6. React Query caching
7. Minimize bundle size (tree shaking, compression)
8. Service worker for offline support (future)
```

### nginx
```
1. Gzip compression for text files
2. Brotli compression (if available)
3. Static file caching
4. HTTP/2 support
5. Connection keep-alive
6. Buffer tuning for large uploads
```

---

## Security Checklist

### Before Going Live
```
✓ Change all default passwords
✓ Generate secure random JWT secrets (32+ chars)
✓ Enable HTTPS (SSL certificate installed)
✓ Configure CORS properly (whitelist frontend domain only)
✓ Enable rate limiting on all endpoints
✓ Validate all user inputs
✓ Set proper file permissions (storage directories)
✓ Enable 2FA for admin account
✓ Review nginx security config
✓ Set secure headers (helmet)
✓ Disable directory listing
✓ Remove debug/development code
✓ Set NODE_ENV=production
✓ Enable logging
✓ Test authentication flows
✓ Test authorization (users can't access others' files)
✓ Test share link security
✓ Review database permissions
✓ Backup database
✓ Document admin credentials securely
✓ Test from external network
✓ Monitor logs for anomalies
```

---

## Future Enhancements (Not in Current Scope)

### Possible Future Features
```
1. Mobile app (React Native)
2. Desktop app (Electron)
3. Real-time notifications (WebSockets)
4. Collaborative editing
5. Comments on files
6. File tagging system
7. Advanced search (content search, OCR)
8. Integration with cloud storage (S3 backup)
9. Media transcoding (adaptive bitrate for videos)
10. Automated backups to external storage
11. Multi-language support (i18n)
12. Dark mode
13. Email notifications
14. Shared folders (collaboration)
15. Public folder listings
16. File preview in browser (not just download)
17. Markdown/code file rendering
18. Image editing (crop, rotate, etc.)
19. Video player with streaming
20. Audio player
21. Document viewer (Office files)
22. Calendar integration (view by date)
23. AI-powered file organization
24. Duplicate photo detection (visual similarity)
25. Encryption at rest
26. End-to-end encryption option
27. Blockchain-based integrity verification
28. IPFS integration
29. Torrent support for large files
30. API for third-party integrations
```

---

## Troubleshooting Guide

### Common Issues

**Issue: Upload fails for large files**
```
Possible causes:
  - nginx timeout too short
  - chunk size too large
  - Storage quota exceeded
  - Network interruption

Solutions:
  - Increase nginx timeouts
  - Reduce chunk size to 50MB
  - Check storage quota
  - Implement resume functionality
```

**Issue: Thumbnails not generating**
```
Possible causes:
  - FFmpeg not installed
  - Sharp library error
  - Worker crashed
  - File format not supported

Solutions:
  - Check PM2 logs: pm2 logs thumbnail-worker
  - Verify FFmpeg installed: ffmpeg -version
  - Restart workers: pm2 restart thumbnail-worker
  - Check file format support
```

**Issue: Can't access from internet**
```
Possible causes:
  - Port forwarding not configured
  - Firewall blocking
  - DuckDNS not updating
  - ISP using CGNAT

Solutions:
  - Verify port forwarding rule
  - Check router firewall
  - Test DuckDNS: ping yourname.duckdns.org
  - Contact ISP about CGNAT
  - Consider Cloudflare Tunnel as alternative
```

**Issue: SSL certificate fails**
```
Possible causes:
  - Port 80 not forwarded
  - nginx running on port 80
  - Domain not pointing to correct IP

Solutions:
  - Forward port 80 temporarily
  - Stop nginx: nginx -s stop
  - Run certbot standalone
  - Verify DNS: nslookup yourname.duckdns.org
```

**Issue: Database connection errors**
```
Possible causes:
  - PostgreSQL not running
  - Wrong credentials
  - Connection limit reached

Solutions:
  - Start PostgreSQL: pg_ctl start
  - Check credentials in .env
  - Check connections: psql -c "SELECT * FROM pg_stat_activity;"
  - Increase max_connections in postgresql.conf
```

**Issue: Phone overheating**
```
Possible causes:
  - CPU-intensive operations (video processing)
  - Too many concurrent uploads
  - Poor ventilation

Solutions:
  - Reduce worker concurrency (PM2 config)
  - Limit upload rate
  - Improve phone cooling (fan, heat sink)
  - Consider upgrade to better device
  - Pause workers during hot weather
```

---

## Contact & Support

### Documentation
```
Full docs available in:
  - /docs/SETUP.md - Setup instructions
  - /docs/API.md - API documentation
  - /docs/DEPLOYMENT.md - Deployment guide
  - /docs/ARCHITECTURE.md - System architecture
```

### Logging
```
Backend logs: ~/file-server/backend/logs/
PM2 logs: ~/.pm2/logs/
nginx logs: $PREFIX/var/log/nginx/
PostgreSQL logs: $PREFIX/var/log/postgresql/
```

---

## Summary

This document contains the complete specification for the Android Phone File Server project. All decisions have been documented including:

- Multi-user support from day 1
- Hash-based storage with deduplication
- Chunked uploads for files up to 100GB
- Automatic thumbnail generation (images, videos, PDFs)
- Shareable links with expiration and download limits
- 2FA authentication
- Background job processing (BullMQ + Redis, no priority)
- Port forwarding + DuckDNS for internet access
- Complete database schema
- Full API specification
- React + Tailwind CSS + shadcn/ui frontend
- Deployment on Android via Termux
- Security measures and best practices
- File versioning and trash bin
- Activity logging and admin panel
- Complete project structure

All technical decisions, architecture choices, and implementation details have been finalized and documented.

**Ready to start coding when you give the signal!**
