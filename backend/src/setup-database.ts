import { Client } from 'pg';
import logger from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
    // Connect as superuser (your system user)
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.USER || 'postgres', // Your macOS username
        password: '', // Usually no password for local superuser
        database: 'postgres'
    });

    try {
        await client.connect();
        logger.info('Connected to PostgreSQL as superuser');

        // Check if user exists
        const userCheck = await client.query(
            "SELECT 1 FROM pg_roles WHERE rolname=$1",
            [process.env.DB_USER]
        );

        if (userCheck.rows.length === 0) {
            logger.info(`Creating user: ${process.env.DB_USER}`);
            await client.query(
                `CREATE USER ${process.env.DB_USER} WITH PASSWORD '${process.env.DB_PASSWORD}'`
            );
            logger.info('✅ User created');
        } else {
            logger.info('User already exists');
        }

        // Check if database exists
        const dbCheck = await client.query(
            "SELECT 1 FROM pg_database WHERE datname=$1",
            [process.env.DB_NAME]
        );

        if (dbCheck.rows.length === 0) {
            logger.info(`Creating database: ${process.env.DB_NAME}`);
            await client.query(
                `CREATE DATABASE ${process.env.DB_NAME} OWNER ${process.env.DB_USER}`
            );
            logger.info('✅ Database created');
        } else {
            logger.info('Database already exists');
        }

        await client.end();

        // Connect to the new database to grant schema privileges
        const dbClient = new Client({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '5432'),
            user: process.env.USER || 'postgres',
            password: '',
            database: process.env.DB_NAME
        });

        await dbClient.connect();
        logger.info('Granting schema privileges...');
        
        await dbClient.query(`GRANT ALL ON SCHEMA public TO ${process.env.DB_USER}`);
        await dbClient.query(`GRANT CREATE ON SCHEMA public TO ${process.env.DB_USER}`);
        
        await dbClient.end();
        logger.info('✅ Database setup complete!');

    } catch (error) {
        logger.error('Database setup failed:', error);
        throw error;
    }
}

setupDatabase();