import { User } from './models';
import { hashPassword } from './services/authService';
import logger from './utils/logger';
import sequelize from './config/database';

async function seedAdmin() {
    console.log("Seeding admin creds")
    try {
        await sequelize.authenticate();
        logger.info('Connected to database');

        // Check if admin already exists
        const existingAdmin = await User.findOne({
            where: { email: 'shubnit12@gmail.com' }
        });

        if (existingAdmin) {
            logger.info('Admin user already exists');
            // process.exit(0);
        }

        // Create admin user
        const hashedPassword = await hashPassword('MyPassword123');
        
        const admin = await User.create({
            username: 'shubnit',
            email: 'shubnit12@gmail.com',
            password_hash: hashedPassword,
            role: 'admin',
            storage_quota: null, // Unlimited for admin
        });

        logger.info('✅ Admin user created successfully', {
            id: admin.id,
            username: admin.username,
            email: admin.email
        });

        const admin2 = await User.create({
            username: 'shubnit2',
            email: 'shubnit122@gmail.com',
            password_hash: hashedPassword,
            role: 'admin',
            storage_quota: null, // Unlimited for admin
        });

        logger.info('✅ Admin user created successfully', {
            id: admin2.id,
            username: admin2.username,
            email: admin2.email
        });

        const user = await User.create({
            username: 'user',
            email: 'user@gmail.com',
            password_hash: hashedPassword,
            role: 'user',
            storage_quota: 21474836480, // Unlimited for admin
        });

        logger.info('✅ Admin user created successfully', {
            id: user.id,
            username: user.username,
            email: user.email
        });

        // process.exit(0);
    } catch (error) {
        logger.error('Failed to seed admin user:', error);
        // process.exit(1);
    }
}

export default seedAdmin