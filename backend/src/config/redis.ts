import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay;
    },
    maxRetriesPerRequest:3 
});

redis.on ('connect' , ()=>{
    console.log('✅ Redis connected successfully')
})

redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
});
 
redis.on('ready', () => {
    console.log('🚀 Redis is ready to accept commands');
});

export const tokenBlacklist = {

    async add(token: string, expiresIn: number): Promise<void> {
        await redis.setex(`blacklist:${token}`, expiresIn, '1');
    },
    async isBlacklisted(token: string): Promise<boolean> {
        const result = await redis.get(`blacklist:${token}`);
        return result !== null;
    },
    async remove(token: string): Promise<void> {
        await redis.del(`blacklist:${token}`);
    }
}

export default redis;