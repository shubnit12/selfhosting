import { User } from './models';
import { hashPassword } from './services/authService';
import logger from './utils/logger';
import sequelize from './config/database';

async function seedAdmin() {
    console.log("Seeding admin creds")
    try {
        await sequelize.authenticate();
        logger.info('Connected to database');

        const adminUsername = process.env.ADMIN_USERNAME!
        const adminEmail = process.env.ADMIN_EMAIL!
        const adminPassword = process.env.ADMIN_PASSWORD!

        // Check if admin already exists
        const existingAdmin = await User.findOne({
            where: { email: adminEmail }
        });

        if (existingAdmin) {
            logger.info('Admin user already exists, skipping seed');
            return;
        }

        // Create admin user from .env credentials
        const hashedPassword = await hashPassword(adminPassword);
        
        const admin = await User.create({
            username: adminUsername,
            email: adminEmail,
            password_hash: hashedPassword,
            role: 'admin',
            storage_quota: null, // Unlimited for admin
        });

        logger.info('✅ Admin user created successfully', {
            id: admin.id,
            username: admin.username,
            email: admin.email
        });

        // Create one test user with 1GB storage quota
        const testHashedPassword = await hashPassword('Sidhu@5911');
        const testUser = await User.create({
            username: 'SidhuMoosewala',
            email: 'sidhumoosa5911@legend.com',
            password_hash: testHashedPassword,
            role: 'user',
            storage_quota: 1073741824, // 1GB in bytes
        });

        logger.info('✅ Test user created successfully', {
            id: testUser.id,
            username: testUser.username,
            email: testUser.email
        });

    } catch (error) {
        logger.error('Failed to seed admin user:', error);
    }
}

export default seedAdmin
