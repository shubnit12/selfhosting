// import crypto from 'crypto';
// import fs from 'fs'
// import {pipeline} from 'stream/promises';
// import logger from '../utils/logger';

import crypto from 'crypto';
import fs from 'fs';
import { createBLAKE3 } from 'hash-wasm';
import logger from '../utils/logger';

interface HashResult {
    hash: string;
    size: number;
    processingTime: number;
}


// ========================================
// HASH CALCULATION (Streaming)
// ========================================
 
/**
 * Calculate SHA256 hash of a file using streams
 * This is memory-efficient for large files (doesn't load entire file in RAM)
 * 
 * @param filePath - Path to file on disk
 * @returns SHA256 hash (64 hex characters)
 */

// export async function calculateFileHash(filePath: string): Promise <HashResult>{
//     const startTime = Date.now();

//     return new Promise((resolve, reject) => {
//         try{
//             // Create hash instance
//             const hash = crypto.createHash('sha256');

//              // Create read stream
//              const stream = fs.createReadStream(filePath);

//              let fileSize = 0

//             // Update hash as data flows through stream
//              stream.on('data', (chunk: Buffer) =>{
//                 hash.update(chunk)
//                 fileSize += chunk.length;
//              })

//              //When stream ends, finalize hash
//              stream.on('end' , () =>{
//                 const hashValue = hash.digest('hex');
//                 const processingTime = Date.now() - startTime;

//                 logger.debug('File hash calculated', {
//                     hash: hashValue.substring(0, 16) + '...',
//                     size: fileSize,
//                     processingTime: `${processingTime}ms`
//                 });

//                 resolve({
//                     hash: hashValue,
//                     size: fileSize,
//                     processingTime
//                 })
//              })

//              stream.on('error', (error)=>{
//                 logger.error('Hash calculation failed', {
//                     error: error.message,
//                     filePath
//                 });
//                 reject(error);
//              })

//         }catch (error){
//             logger.error('Failed to create hash stream', {
//                 error: (error as Error).message,
//                 filePath
//             });
//             reject(error);
//         }
//     })
// }
export async function calculateFileHash(filePath: string): Promise<HashResult> {
    const startTime = Date.now();

    try {
        const hasher = await createBLAKE3();
        hasher.init();

        const stream = fs.createReadStream(filePath);
        let fileSize = 0;

        for await (const chunk of stream) {
            hasher.update(chunk as Buffer);
            fileSize += (chunk as Buffer).length;
        }

        const hashValue = hasher.digest('hex');
        const processingTime = Date.now() - startTime;

        logger.debug('File hash calculated', {
            hash: hashValue.substring(0, 16) + '...',
            size: fileSize,
            processingTime: `${processingTime}ms`
        });

        return { hash: hashValue, size: fileSize, processingTime };

    } catch (error) {
        logger.error('Hash calculation failed', {
            error: (error as Error).message,
            filePath
        });
        throw error;
    }
}

/**
 * Calculate SHA256 hash of a Buffer (for small files or chunks)
 * 
 * @param buffer - File data as Buffer
 * @returns SHA256 hash (64 hex characters)
 */
// export function calculateBufferHash(buffer: Buffer) : string {
//     const hash = crypto.createHash('sha256').update(buffer).digest('hex');
//         logger.debug('Buffer hash calculated', {
//         hash: hash.substring(0, 16) + '...',
//         size: buffer.length
//     });
    
//     return hash;
// }
export async function calculateBufferHash(buffer: Buffer): Promise<string> {
    const hasher = await createBLAKE3();
    hasher.init();
    hasher.update(buffer);
    const hash = hasher.digest('hex');
 
    logger.debug('Buffer hash calculated', {
        hash: hash.substring(0, 16) + '...',
        size: buffer.length
    });
 
    return hash;
}


/**
 * Calculate SHA256 hash of a string
 * Useful for generating tokens, IDs, etc.
 * 
 * @param data - String to hash
 * @returns SHA256 hash (64 hex characters)
 */
export function calculateStringHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify file hash matches expected hash
 * 
 * @param filePath - Path to file
 * @param expectedHash - Expected SHA256 hash
 * @returns true if match, false otherwise
 */

export async function verifyFileHash(
    filePath: string,
    expectedHash:string
): Promise<boolean>{
    try {
        const result = await calculateFileHash(filePath);
        console.log("hash calculated in backend of file : " , result)
        const matches = result.hash === expectedHash;

        if(!matches){
             logger.warn('Hash mismatch detected', {
                expected: expectedHash.substring(0, 16) + '...',
                actual: result.hash.substring(0, 16) + '...',
                filePath
            });
        }

        return matches;
    } catch (error) {
        logger.error('Hash verification failed', {
            error: (error as Error).message,
            filePath
        });
        return false;
    }
}

/**
 * Calculate hash of multiple chunks and combine
 * Used for verifying chunked uploads
 * 
 * @param chunkPaths - Array of chunk file paths in order
 * @returns Combined SHA256 hash
 */
// export async function calculateChunkedFileHash(
//     chunkPaths: string[]
// ): Promise<string> {
//     const hash = crypto.createHash('sha256');
    
//     for (const chunkPath of chunkPaths) {
//         const chunkData = await fs.promises.readFile(chunkPath);
//         hash.update(chunkData);
//     }
    
//     const finalHash = hash.digest('hex');
    
//     logger.debug('Chunked file hash calculated', {
//         hash: finalHash.substring(0, 16) + '...',
//         chunks: chunkPaths.length
//     });
    
//     return finalHash;
// }
export async function calculateChunkedFileHash(
    chunkPaths: string[]
): Promise<string> {
    const hasher = await createBLAKE3();
    hasher.init();

    for (const chunkPath of chunkPaths) {
        const chunkData = await fs.promises.readFile(chunkPath);
        hasher.update(chunkData);
    }

    const finalHash = hasher.digest('hex');

    logger.debug('Chunked file hash calculated', {
        hash: finalHash.substring(0, 16) + '...',
        chunks: chunkPaths.length
    });

    return finalHash;
}