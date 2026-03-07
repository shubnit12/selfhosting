import { Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { File } from '../models';
import { generateThumbnail } from '../services/thumbnailService';
import { getFilePath } from '../services/storageService';
import logger from '../utils/logger';

// Job data interface
interface ThumbnailJobData {
    fileId: string;
    filePath: string;
    fileHash: string;
    mimeType: string;
}

// Process thumbnail job
async function processThumbnailJob(job: Job<ThumbnailJobData>): Promise<void> {
    const { fileId, filePath, fileHash, mimeType } = job.data;

    try {
        logger.info('Processing thumbnail job', {
            jobId: job.id,
            fileId,
            mimeType
        });

        // Generate thumbnail
        const thumbnailPath = await generateThumbnail(filePath, fileHash, mimeType);

        if (thumbnailPath) {
            // Update file record with thumbnail path
            await File.update(
                { thumbnail_path: thumbnailPath },
                { where: { id: fileId } }
            );

            logger.info('Thumbnail job completed', {
                jobId: job.id,
                fileId,
                thumbnailPath
            });
        } else {
            logger.debug('No thumbnail generated (unsupported type)', {
                jobId: job.id,
                fileId,
                mimeType
            });
        }
    } catch (error) {
        logger.error('Thumbnail job failed', {
            jobId: job.id,
            fileId,
            error: (error as Error).message
        });
        throw error;
    }
}

// Create worker
export const thumbnailWorker = new Worker('thumbnails', processThumbnailJob, {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null
    },
    concurrency: 1,  // Process 1 job at a time
    limiter: {
        max: 10,      // Max 10 jobs
        duration: 1000 // Per second
    }
});

// Worker event handlers
thumbnailWorker.on('completed', (job) => {
    logger.debug('Thumbnail worker completed job', { jobId: job.id });
});

thumbnailWorker.on('failed', (job, error) => {
    logger.error('Thumbnail worker job failed', {
        jobId: job?.id,
        error: error.message
    });
});

thumbnailWorker.on('error', (error) => {
    logger.error('Thumbnail worker error', { error: error.message });
});

logger.info('Thumbnail worker started', {
    concurrency: 1,
    queue: 'thumbnails'
});