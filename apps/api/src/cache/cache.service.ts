import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

    async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
        try {
            const cached = await this.redis.get(key);
            if (cached !== null) return JSON.parse(cached) as T;
        } catch (error) {
            this.logger.warn(`Cache read failed for ${key}: ${String(error)}`);
        }

        const value = await loader();
        try {
            await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (error) {
            this.logger.warn(`Cache write failed for ${key}: ${String(error)}`);
        }
        return value;
    }

    async invalidate(...keys: string[]): Promise<void> {
        const unique = [...new Set(keys)].filter((key) => key.length > 0);
        if (unique.length === 0) return;
        try {
            await this.redis.del(...unique);
        } catch (error) {
            this.logger.warn(`Cache invalidation failed: ${String(error)}`);
        }
    }

    /** SCAN-based prefix invalidation; never blocks Redis with KEYS. */
    async invalidatePrefix(prefix: string): Promise<void> {
        let cursor = '0';
        try {
            do {
                const [next, keys] = await this.redis.scan(
                    cursor,
                    'MATCH',
                    `${prefix}*`,
                    'COUNT',
                    100,
                );
                cursor = next;
                if (keys.length > 0) await this.redis.del(...keys);
            } while (cursor !== '0');
        } catch (error) {
            this.logger.warn(`Cache prefix invalidation failed for ${prefix}: ${String(error)}`);
        }
    }
}
