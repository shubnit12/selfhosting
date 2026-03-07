import { Worker, Job } from 'bullmq';
import { runAllCleanupTasks } from '../services/cleanupService';
import logger from '../utils/logger';

// Job data interface
interface CleanupJobData {
    taskType: 'all' | 'orphaned-files' | 'expired-sessions' | 'orphaned-thumbnails';
}

// Process cleanup job
async function processCleanupJob(job: Job<CleanupJobData>): Promise<void> {
    const { taskType } = job.data;

    try {
        logger.info('Processing cleanup job', {
            jobId: job.id,
            taskType
        });

        // Run all cleanup tasks
        const results = await runAllCleanupTasks();

        logger.info('Cleanup job completed', {
            jobId: job.id,
            results
        });
    } catch (error) {
        logger.error('Cleanup job failed', {
            jobId: job.id,
            error: (error as Error).message
        });
        throw error;
    }
}

// Create worker
export const cleanupWorker = new Worker('cleanup', processCleanupJob, {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null
    },
    concurrency: 1
});

// Worker event handlers
cleanupWorker.on('completed', (job) => {
    logger.info('Cleanup worker completed job', { jobId: job.id });
});

cleanupWorker.on('failed', (job, error) => {
    logger.error('Cleanup worker job failed', {
        jobId: job?.id,
        error: error.message
    });
});

cleanupWorker.on('error', (error) => {
    logger.error('Cleanup worker error', { error: error.message });
});

logger.info('Cleanup worker started', {
    concurrency: 1,
    queue: 'cleanup'
});