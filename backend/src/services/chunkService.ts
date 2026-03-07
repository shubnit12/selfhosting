import fs from 'fs';
import path from 'path';
import redis from '../config/redis';
import logger from '../utils/logger';
import { 
    getTempUploadPath, 
    getChunkPath, 
    ensureDirectoryExists,
    deleteDirectory 
} from './storageService';

// ========================================
// INTERFACES
// ========================================

interface UploadSession {
    session_id: string;
    user_id: string;
    filename: string;
    file_size: number;
    file_hash: string;
    mime_type: string;
    total_chunks: number;
    chunks_received: number[];
    chunks_missing: number[];
    folder_id: string | null;
    created_at: string;
    expires_at: string;
}

interface ChunkUploadResult {
    chunk_index: number;
    received: number;
    total_chunks: number;
    chunks_remaining: number;
}

// ========================================
// UPLOAD SESSION MANAGEMENT (Redis)
// ========================================

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Create new upload session
 * 
 * @param sessionId - Upload session UUID
 * @param userId - User ID
 * @param filename - Original filename
 * @param fileSize - Total file size
 * @param fileHash - SHA256 hash
 * @param mimeType - MIME type
 * @param totalChunks - Number of chunks
 * @param folderId - Folder ID (optional)
 */
export async function createUploadSession(
    sessionId: string,
    userId: string,
    filename: string,
    fileSize: number,
    fileHash: string,
    mimeType: string,
    totalChunks: number,
    folderId: string | null = null
): Promise<UploadSession> {
    try {
        // Create chunks_missing array [0, 1, 2, ..., totalChunks-1]
        const chunks_missing = Array.from({ length: totalChunks }, (_, i) => i);

        const session: UploadSession = {
            session_id: sessionId,
            user_id: userId,
            filename,
            file_size: fileSize,
            file_hash: fileHash,
            mime_type: mimeType,
            total_chunks: totalChunks,
            chunks_received: [],
            chunks_missing,
            folder_id: folderId,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + SESSION_TTL * 1000).toISOString()
        };

        // Store in Redis with TTL
        await redis.setex(
            `upload:${sessionId}`,
            SESSION_TTL,
            JSON.stringify(session)
        );

        // Create temp directory for chunks
        const tempDir = getTempUploadPath(sessionId);
        await ensureDirectoryExists(tempDir);

        logger.info('Upload session created', {
            sessionId,
            userId,
            filename,
            totalChunks,
            expiresIn: '24 hours'
        });

        return session;

    } catch (error) {
        logger.error('Failed to create upload session', {
            error: (error as Error).message,
            sessionId
        });
        throw error;
    }
}

/**
 * Get upload session from Redis
 * 
 * @param sessionId - Upload session UUID
 * @returns Upload session or null if not found
 */
export async function getUploadSession(sessionId: string): Promise<UploadSession | null> {
    try {
        const data = await redis.get(`upload:${sessionId}`);

        if (!data) {
            logger.warn('Upload session not found or expired', { sessionId });
            return null;
        }

        const session: UploadSession = JSON.parse(data);
        
        logger.debug('Upload session retrieved', {
            sessionId,
            chunksReceived: session.chunks_received.length,
            totalChunks: session.total_chunks
        });

        return session;

    } catch (error) {
        logger.error('Failed to get upload session', {
            error: (error as Error).message,
            sessionId
        });
        throw error;
    }
}

/**
 * Update upload session in Redis
 * 
 * @param session - Updated session object
 */
export async function updateUploadSession(session: UploadSession): Promise<void> {
    try {
        // Extend TTL on activity (reset 24-hour timer)
        await redis.setex(
            `upload:${session.session_id}`,
            SESSION_TTL,
            JSON.stringify(session)
        );

        logger.debug('Upload session updated', {
            sessionId: session.session_id,
            chunksReceived: session.chunks_received.length
        });

    } catch (error) {
        logger.error('Failed to update upload session', {
            error: (error as Error).message,
            sessionId: session.session_id
        });
        throw error;
    }
}

/**
 * Delete upload session from Redis
 * 
 * @param sessionId - Upload session UUID
 */
export async function deleteUploadSession(sessionId: string): Promise<void> {
    try {
        await redis.del(`upload:${sessionId}`);
        
        logger.debug('Upload session deleted', { sessionId });

    } catch (error) {
        logger.error('Failed to delete upload session', {
            error: (error as Error).message,
            sessionId
        });
        throw error;
    }
}

// ========================================
// CHUNK OPERATIONS
// ========================================

/**
 * Save uploaded chunk to disk
 * 
 * @param sessionId - Upload session UUID
 * @param chunkIndex - Chunk number
 * @param chunkData - Chunk buffer
 * @returns Chunk upload result
 */
export async function saveChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer
): Promise<ChunkUploadResult> {
    try {
        // Get session
        const session = await getUploadSession(sessionId);

        if (!session) {
            throw new Error('Upload session not found or expired');
        }

        // Validate chunk index
        if (chunkIndex < 0 || chunkIndex >= session.total_chunks) {
            throw new Error(`Invalid chunk index: ${chunkIndex}`);
        }

        // Check if chunk already received
        if (session.chunks_received.includes(chunkIndex)) {
            logger.warn('Chunk already received (skipping)', {
                sessionId,
                chunkIndex
            });
            
            return {
                chunk_index: chunkIndex,
                received: session.chunks_received.length,
                total_chunks: session.total_chunks,
                chunks_remaining: session.chunks_missing.length
            };
        }

        // Save chunk to disk
        const chunkPath = getChunkPath(sessionId, chunkIndex);
        await fs.promises.writeFile(chunkPath, chunkData);

        // Update session
        session.chunks_received.push(chunkIndex);
        session.chunks_received.sort((a, b) => a - b);  // Keep sorted
        session.chunks_missing = session.chunks_missing.filter(i => i !== chunkIndex);

        await updateUploadSession(session);

        logger.info('Chunk saved', {
            sessionId,
            chunkIndex,
            chunkSize: chunkData.length,
            progress: `${session.chunks_received.length}/${session.total_chunks}`
        });

        return {
            chunk_index: chunkIndex,
            received: session.chunks_received.length,
            total_chunks: session.total_chunks,
            chunks_remaining: session.chunks_missing.length
        };

    } catch (error) {
        logger.error('Failed to save chunk', {
            error: (error as Error).message,
            sessionId,
            chunkIndex
        });
        throw error;
    }
}

/**
 * Assemble all chunks into final file
 * 
 * @param sessionId - Upload session UUID
 * @param outputPath - Where to save assembled file
 * @returns File size in bytes
 */
export async function assembleChunks(
    sessionId: string,
    outputPath: string
): Promise<number> {
    try {
        const session = await getUploadSession(sessionId);

        if (!session) {
            throw new Error('Upload session not found');
        }

        // Verify all chunks received
        if (session.chunks_missing.length > 0) {
            throw new Error(
                `Missing chunks: ${session.chunks_missing.join(', ')}`
            );
        }

        // Create write stream for output file
        const writeStream = fs.createWriteStream(outputPath);
        let totalSize = 0;

        // Append chunks in order with proper stream handling
        for (let i = 0; i < session.total_chunks; i++) {
            const chunkPath = getChunkPath(sessionId, i);
            const chunkData = await fs.promises.readFile(chunkPath);
            
            // Write chunk and handle backpressure
            const canContinue = writeStream.write(chunkData);
            
            // If buffer is full, wait for drain event
            if (!canContinue) {
                await new Promise(resolve => writeStream.once('drain', resolve));
            }
            
            totalSize += chunkData.length;
        }

        // Close stream and wait for finish
        await new Promise((resolve, reject) => {
            writeStream.end();
            writeStream.on('finish', () => resolve(true));
            writeStream.on('error', reject);
        });

        logger.info('Chunks assembled successfully', {
            sessionId,
            totalChunks: session.total_chunks,
            totalSize,
            outputPath
        });

        return totalSize;

    } catch (error) {
        logger.error('Failed to assemble chunks', {
            error: (error as Error).message,
            sessionId
        });
        throw error;
    }
}

/**
 * Cleanup upload session (delete temp files and Redis entry)
 * 
 * @param sessionId - Upload session UUID
 */
export async function cleanupUploadSession(sessionId: string): Promise<void> {
    try {
        // Delete temp directory with all chunks
        const tempDir = getTempUploadPath(sessionId);
        await deleteDirectory(tempDir);

        // Delete Redis session
        await deleteUploadSession(sessionId);

        logger.info('Upload session cleaned up', { sessionId });

    } catch (error) {
        logger.error('Failed to cleanup upload session', {
            error: (error as Error).message,
            sessionId
        });
        // Don't throw - cleanup is best effort
    }
}

/**
 * Check if all chunks received
 * 
 * @param sessionId - Upload session UUID
 * @returns true if all chunks received
 */
export async function areAllChunksReceived(sessionId: string): Promise<boolean> {
    const session = await getUploadSession(sessionId);
    
    if (!session) {
        return false;
    }

    return session.chunks_missing.length === 0;
}

/**
 * Get upload progress
 * 
 * @param sessionId - Upload session UUID
 * @returns Progress percentage (0-100)
 */
export async function getUploadProgress(sessionId: string): Promise<number> {
    const session = await getUploadSession(sessionId);
    
    if (!session) {
        return 0;
    }

    return (session.chunks_received.length / session.total_chunks) * 100;
}