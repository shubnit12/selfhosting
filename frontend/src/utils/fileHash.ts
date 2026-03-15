// /**
//  * Calculate SHA256 hash of file using streaming (matches backend algorithm)
//  */

// import { sha256 } from "js-sha256";

// /**
//  * Calculate SHA256 hash of file using streaming (matches backend algorithm)
//  * Memory efficient - works for any file size
//  */
// export async function calculateFileHash(file: File,  onProgress?: (percent: number) => void): Promise<string> {
//     const chunkSize = 10 * 1024 * 1024; // 10MB chunks
//     let offset = 0;
    
//     // Create hash instance
//     const hash = sha256.create();
    
//     // Read and hash file in chunks
//     while (offset < file.size) {
//         const chunk = file.slice(offset, offset + chunkSize);
//         const arrayBuffer = await chunk.arrayBuffer();
//         const uint8Array = new Uint8Array(arrayBuffer);
        
//         // Update hash with this chunk
//         hash.update(uint8Array);
        
//         offset += chunkSize;

//         if (onProgress) {
//             const percent = Math.min(Math.round((offset / file.size) * 100), 100);
//             onProgress(percent);
//         }
//     }
    
//     // Finalize and return hex string
//     return hash.hex();
// }

 
/**
 * Split file into chunks
 */
export function splitFileIntoChunks(file: File, chunkSize: number = 5 * 1024 * 1024): Blob[] {
    const chunks: Blob[] = [];
    let offset = 0;
 
    while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        chunks.push(chunk);
        offset += chunkSize;
    }
 
    return chunks;
}


import { createBLAKE3 } from 'hash-wasm';

export async function calculateFileHash(file: File, onProgress?: (percent: number) => void): Promise<string> {
    const chunkSize = 50 * 1024 * 1024; // 50MB chunks
    let offset = 0;

    const hasher = await createBLAKE3();
    hasher.init();

    while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        const arrayBuffer = await chunk.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        hasher.update(uint8Array);
        offset += chunkSize;

        if (onProgress) {
            const percent = Math.min(Math.round((offset / file.size) * 100), 100);
            onProgress(percent);
        }
    }

    return hasher.digest('hex');
}
