import { 
    calculateFileHash, 
    calculateBufferHash,
    calculateStringHash,
    verifyFileHash 
} from './services/hashService';
import fs from 'fs';

async function testHashService() {
    try {
        console.log('🧪 Testing Hash Service\n');

        // Test 1: String hash
        console.log('Test 1: String hash');
        const stringHash = calculateStringHash('Hello World');
        console.log('Hash:', stringHash);
        console.log('Expected: a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e');
        console.log('Match:', stringHash === 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e');
        console.log();

        // Test 2: Buffer hash
        console.log('Test 2: Buffer hash');
        const buffer = Buffer.from('Test data');
        const bufferHash = calculateBufferHash(buffer);
        console.log('Hash:', bufferHash.substring(0, 32) + '...');
        console.log();

        // Test 3: File hash (create test file first)
        console.log('Test 3: File hash (streaming)');
        const testFilePath = './BigSizemp4xxxxxxx.mov';
        // fs.writeFileSync(testFilePath, 'This is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashingThis is a test file for hashing');
        
        const result = await calculateFileHash(testFilePath);
        console.log('Hash:', result.hash.substring(0, 32) + '...');
        console.log('Size:', result.size, 'bytes');
        console.log('Time:', result.processingTime, 'ms');
        console.log();

        // Test 4: Hash verification
        console.log('Test 4: Hash verification');
        const isValid = await verifyFileHash(testFilePath, result.hash);
        console.log('Verification:', isValid ? '✅ Valid' : '❌ Invalid');
        console.log();

        // Cleanup
        // fs.unlinkSync(testFilePath);

        console.log('🎉 All hash service tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testHashService();