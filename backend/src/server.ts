import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import app from './app';
import sequelize from './config/database';
import redis from './config/redis';
import { SERVER_CONFIG } from './config/constants';
import logger from './utils/logger';
import seedAdmin from './seed-admin';
import { initializeStorage } from './services/storageService';
import { seedTestData } from './seed-test-data';
import './workers/thumbnailWorker';
import './workers/cleanupWorker';

// ========================================
//              START SERVER
// ========================================

async function startServer() {
    try {
        // 1. Test database connection
        logger.info('Testing database connection...');
        await sequelize.authenticate();
        logger.info('✅ Database connected successfully');

        // 2. Sync database models (development only)
        if (SERVER_CONFIG.NODE_ENV === 'development') {
            logger.info('Syncing database models...');
            await sequelize.sync({ force: true });
            logger.info('✅ Database models synced');
        }

        // 3. Test Redis connection
        logger.info('Testing Redis connection...');
        await redis.ping();
        logger.info('✅ Redis connected successfully');

        // 4. Initialize storage directories  ← Add this
        logger.info('Initializing storage directories...');
        await initializeStorage();
        logger.info('✅ Storage initialized');

        // 5. Start Express server
        const PORT = SERVER_CONFIG.PORT;
        
        app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📝 Environment: ${SERVER_CONFIG.NODE_ENV}`);
            logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
            logger.info(`💚 Health check: http://localhost:${PORT}/health`);
        });
        await seedAdmin()
        await seedTestData();
        

    } catch (error) {
        logger.error('Failed to start server', {
            error: (error as Error).message,
            stack: (error as Error).stack
        });
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason,
        promise
    });
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    
    // Close database connection
    await sequelize.close();
    logger.info('Database connection closed');
    
    // Close Redis connection
    redis.disconnect();
    logger.info('Redis connection closed');
    
    process.exit(0);
});

// Start the server
startServer();


import * as v8 from 'node:v8';

const heapStatistics = v8.getHeapStatistics();
// heap_size_limit is in bytes, convert to megabytes (MB)
const maxHeapSizeInMB = heapStatistics.heap_size_limit / (1024 * 1024); 

console.log(`Max Heap Size Limit: ${maxHeapSizeInMB.toFixed(2)} MB`); 
