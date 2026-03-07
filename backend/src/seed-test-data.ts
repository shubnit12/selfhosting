import { User, Folder, File } from './models';
import { createFolder } from './services/folderService';
import { calculateFileHash } from './services/hashService';
import { createFileReference } from './services/deduplicationService';
import { generateStoragePath, getFilePath, ensureFileDirectory } from './services/storageService';
import { addToStorageUsed } from './services/quotaService';
import logger from './utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Seed test data for development
 * Creates folders and uploads test files
 */
export async function seedTestData(): Promise<void> {
    try {
        logger.info('Starting test data seeding...');

        // Find all users
        const admin1 = await User.findOne({ where: { email: 'shubnit12@gmail.com' } });
        const admin2 = await User.findOne({ where: { email: 'shubnit122@gmail.com' } });
        const regularUser = await User.findOne({ where: { email: 'user@gmail.com' } });

        const users = [
            { user: admin1, name: 'shubnit12@gmail.com' },
            { user: admin2, name: 'shubnit122@gmail.com' },
            { user: regularUser, name: 'user@gmail.com' }
        ];

        for (const { user, name } of users) {
            if (!user) {
                logger.warn(`User ${name} not found, skipping`);
                continue;
            }

            // Check if test data already exists for this user
            const existingFolder = await Folder.findOne({
                where: {
                    user_id: user.id,
                    name: 'TestFolder'
                }
            });

            if (existingFolder) {
                logger.info(`Test data already exists for ${name}, skipping`);
                continue;
            }

            logger.info(`Creating test folders and files for ${name}...`);

            // 1. Create root folder
            const rootFolder = await createFolder(user.id, 'TestFolder', null);
            logger.info(`Created root folder: ${rootFolder.path}`);

            // 2. Create subfolder
            const subFolder = await createFolder(user.id, 'SubFolder', rootFolder.id);
            logger.info(`Created subfolder: ${subFolder.path}`);

            // 3. Create nested subfolder
            const nestedFolder = await createFolder(user.id, 'NestedFolder', subFolder.id);
            logger.info(`Created nested subfolder: ${nestedFolder.path}`);

            // 4. Upload files to root folder - user-specific content
            await uploadTestFile(
                user.id, 
                rootFolder.id, 
                `${user.username}-welcome.txt`,
                `Welcome ${user.username}!\n\nThis is your personal file storage space.\nEmail: ${user.email}\nRole: ${user.role}\nStorage Quota: ${user.storage_quota ? `${(user.storage_quota / (1024**3)).toFixed(2)} GB` : 'Unlimited'}\n\nFeel free to organize your files and folders as needed.`
            );
            await uploadTestFile(
                user.id, 
                rootFolder.id, 
                'notes.txt',
                `Personal Notes for ${user.username}\n${'='.repeat(40)}\n\n- Remember to backup important files\n- Check storage usage regularly\n- Use folders to organize content\n- Share files securely with share links\n\nLast updated: ${new Date().toLocaleDateString()}`
            );
            if (name === 'shubnit12@gmail.com') {
                await uploadTestFile(user.id, rootFolder.id, 'smolsize.mov');
            }

            // 5. Upload files to subfolder - project/work related
            await uploadTestFile(
                user.id, 
                subFolder.id, 
                'project-overview.txt',
                `Project Overview - ${user.username}\n${'='.repeat(40)}\n\nProject Name: ${user.role === 'admin' ? 'System Administration' : 'Personal Projects'}\nOwner: ${user.username}\nCreated: ${new Date().toLocaleDateString()}\n\nObjectives:\n- Organize digital assets\n- Maintain secure file storage\n- Collaborate with team members\n\nStatus: Active`
            );
            await uploadTestFile(
                user.id, 
                subFolder.id, 
                'tasks.txt',
                `Task List - ${user.username}\n${'='.repeat(40)}\n\n[ ] Review uploaded files\n[ ] Create folder structure\n[ ] Set up share links\n[x] Initial setup complete\n\nPriority Tasks:\n1. Organize documents by category\n2. Archive old files\n3. Review storage usage\n\nNotes: Keep this list updated regularly.`
            );
            await uploadTestFile(
                user.id, 
                subFolder.id, 
                'meeting-notes.txt',
                `Meeting Notes - ${user.username}\n${'='.repeat(40)}\n\nDate: ${new Date().toLocaleDateString()}\nAttendees: ${user.username}\n\nAgenda:\n1. File organization strategy\n2. Storage quota management\n3. Security best practices\n\nAction Items:\n- Implement folder hierarchy\n- Review access permissions\n- Schedule regular backups\n\nNext Meeting: TBD`
            );

            // 6. Upload files to nested folder - documentation
            await uploadTestFile(
                user.id, 
                nestedFolder.id, 
                'documentation.txt',
                `Documentation - ${user.username}\n${'='.repeat(40)}\n\nFile Storage Guidelines\n\n1. Naming Conventions:\n   - Use descriptive names\n   - Avoid special characters\n   - Include dates when relevant\n\n2. Folder Structure:\n   - Keep hierarchy logical\n   - Don't nest too deeply\n   - Group related files\n\n3. Best Practices:\n   - Regular cleanup\n   - Tag important files\n   - Use share links for collaboration\n\nFor support, contact: admin@selfhost.com`
            );
            await uploadTestFile(
                user.id, 
                nestedFolder.id, 
                'changelog.txt',
                `Changelog - ${user.username}\n${'='.repeat(40)}\n\n${new Date().toLocaleDateString()} - Initial Setup\n- Created folder structure\n- Uploaded initial files\n- Configured storage settings\n\n${new Date(Date.now() - 86400000).toLocaleDateString()} - Account Created\n- User account activated\n- Storage quota assigned\n- Welcome email sent\n\nAll changes are logged for audit purposes.`
            );

            logger.info(`✅ Test data seeded successfully for ${name}`);
            const movieFile = name === 'shubnit12@gmail.com' ? '\n    - smolsize.mov' : '';
            logger.info(`Created structure for ${name}:
  /${rootFolder.name}
    - ${user.username}-welcome.txt
    - notes.txt${movieFile}
    /${rootFolder.name}/${subFolder.name}
      - project-overview.txt
      - tasks.txt
      - meeting-notes.txt
      /${rootFolder.name}/${subFolder.name}/${nestedFolder.name}
        - documentation.txt
        - changelog.txt
        `);
        }

        logger.info('✅ All test data seeded successfully');

    } catch (error) {
        logger.error('Failed to seed test data', {
            error: (error as Error).message
        });
    }
}

/**
 * Helper: Upload test file
 */
async function uploadTestFile(
    userId: string,
    folderId: string,
    filename: string,
    content?: string
): Promise<void> {
    try {
        const tempPath = path.join(__dirname, '../storage/temp', filename);
        
        // Check if actual file exists in backend directory
        const actualFilePath = path.join(__dirname, '..', filename);
        
        if (fs.existsSync(actualFilePath)) {
            // Copy actual file
            await fs.promises.copyFile(actualFilePath, tempPath);
            logger.info(`Using actual file: ${filename}`);
        } else if (content) {
            // Create text file with content
            await fs.promises.writeFile(tempPath, content);
            logger.info(`Created text file: ${filename}`);
        } else {
            // Create default text file
            await fs.promises.writeFile(tempPath, `Test file: ${filename}`);
            logger.info(`Created default file: ${filename}`);
        }

        // Calculate hash
        const hashResult = await calculateFileHash(tempPath);
        const fileHash = hashResult.hash;
        const fileSize = hashResult.size;

        // Generate storage path
        const extension = path.extname(filename);
        const storagePath = generateStoragePath(fileHash, extension);
        const finalPath = getFilePath(fileHash, extension);

        // Ensure directory exists
        await ensureFileDirectory(finalPath);

        // Move file to storage
        await fs.promises.copyFile(tempPath, finalPath);
        await fs.promises.unlink(tempPath);

        // Create file reference
        await createFileReference(fileHash, storagePath);

        // Create file record
        const file = await File.create({
            user_id: userId,
            folder_id: folderId,
            original_name: filename,
            stored_name: path.basename(finalPath),
            file_path: storagePath,
            file_hash: fileHash,
            mime_type: filename.endsWith('.txt') ? 'text/plain' : 'video/quicktime',
            size: fileSize,
            upload_status: 'completed',
            is_available: true
        });

        // Update storage usage
        await addToStorageUsed(userId, fileSize);

        logger.info(`Uploaded test file: ${filename}`, {
            fileId: file.id,
            size: fileSize
        });

    } catch (error) {
        logger.error(`Failed to upload test file: ${filename}`, {
            error: (error as Error).message
        });
    }
}