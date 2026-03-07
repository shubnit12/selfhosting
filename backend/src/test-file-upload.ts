import { calculateFileHash } from './services/hashService';
import fs from 'fs';

async function getFileInfo() {
    const filePath = './bigsize.mov';
    
    // Create test file if doesn't exist
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'This is a test file for upload testing');
    }
    
    const result = await calculateFileHash(filePath);
    const stats = fs.statSync(filePath);
    
    console.log('\n📄 File Information for Testing:\n');
    console.log('Filename:', 'bigsize.mov');
    console.log('Size:', stats.size, 'bytes');
    console.log('Hash:', result.hash);
    console.log('MIME type:', 'text/plain');
    console.log('\n📋 Copy this JSON for Swagger:\n');
    console.log(JSON.stringify({
        file_hash: result.hash,
        file_size: stats.size,
        filename: 'bigsize.mov',
        mime_type: 'text/plain',
        folder_id: null
    }, null, 2));
}

getFileInfo();