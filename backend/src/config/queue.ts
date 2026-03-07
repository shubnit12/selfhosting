import { Queue, QueueOptions } from 'bullmq';
import redis from './redis';
import logger from '../utils/logger';

// Queue options
const queueOptions: QueueOptions = {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: {
            age: 24 * 3600
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    }
};

// Create thumbnail queue
export const thumbnailQueue = new Queue('thumbnails', queueOptions);

// Create cleanup queue
export const cleanupQueue = new Queue('cleanup', queueOptions);

// Schedule cleanup job to run daily at 3 AM
cleanupQueue.add(
    'daily-cleanup',
    { taskType: 'all' },
    {
        repeat: {
            pattern: '0 3 * * *'  // Cron: Every day at 3 AM
        }
    }
);

logger.info('BullMQ queues initialized', {
    queues: ['thumbnails', 'cleanup'],
    scheduled: 'Daily cleanup at 3 AM'
});


// Graceful shutdown
process.on('SIGTERM', async () => {
    await thumbnailQueue.close();
    await cleanupQueue.close();
});