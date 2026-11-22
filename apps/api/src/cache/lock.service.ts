import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';

const RELEASE_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;

export interface RedisLock {
    /** Call in `finally`; safe to call more than once. */
    release(): Promise<void>;
}

@Injectable()
export class LockService {
    private readonly logger = new Logger(LockService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

    /**
     * Optional checkout guard. Failure to acquire/release never fails the sale:
     * PostgreSQL FOR UPDATE remains the authoritative oversell protection.
     */
    async acquire(key: string, ttlSeconds = 10): Promise<RedisLock | null> {
        const token = randomUUID();
        try {
            const result = await this.redis.set(key, token, 'EX', ttlSeconds, 'NX');
            if (result !== 'OK') return null;
        } catch (error) {
            this.logger.warn(`Redis lock acquire failed for ${key}: ${String(error)}`);
            return null;
        }

        let released = false;
        return {
            release: async () => {
                if (released) return;
                released = true;
                try {
                    await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
                } catch (error) {
                    this.logger.warn(`Redis lock release failed for ${key}: ${String(error)}`);
                }
            },
        };
    }
}
